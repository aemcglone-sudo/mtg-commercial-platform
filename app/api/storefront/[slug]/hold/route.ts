import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';
import { notifyShopOwner } from '@/lib/marketplace/notify';
import { holdRequestedSms } from '@/lib/marketplace/sms';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface ShopRow {
  id: string;
  name: string;
  user_id: string;
  address: string | null;
  request_expiry_hours: string;
  max_active_holds: string;
}

interface InventoryRow {
  id: string;
  card_name: string;
  scryfall_id: string;
  set_code: string;
  collector_number: string | null;
  condition: string;
  foil: boolean;
  price_cents: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const shop = await findOne<ShopRow>(
    `SELECT s.id, s.name, s."userId" AS user_id, s.address,
            sp.request_expiry_hours::text, sp.max_active_holds::text
     FROM shops s
     LEFT JOIN shop_notification_prefs sp ON sp.shop_id = s.id
     WHERE s.slug = ? AND s."isActive" = true`,
    [slug]
  );
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as {
    inventoryItemId: string;
    collectorNote?: string;
    pickupWindow?: string;
    guestName?: string;
    guestEmail?: string;
  };

  if (!body.inventoryItemId) {
    return NextResponse.json({ error: 'inventoryItemId is required' }, { status: 400 });
  }

  const item = await findOne<InventoryRow>(
    `SELECT id, "cardName" AS card_name, "scryfallId" AS scryfall_id, "setCode" AS set_code,
            "collectorNumber" AS collector_number, condition, foil, "priceCents"::text AS price_cents
     FROM shop_inventory WHERE id = ? AND "shopId" = ? AND quantity > 0`,
    [body.inventoryItemId, shop.id]
  );
  if (!item) return NextResponse.json({ error: 'Item not found or out of stock' }, { status: 404 });

  // Determine if this is an authenticated request or guest
  const userId = getAuthenticatedUserId(req);
  let guestToken: string | null = null;

  if (!userId) {
    // Guest path — name + email required
    if (!body.guestName?.trim() || !body.guestEmail?.trim()) {
      return NextResponse.json({ error: 'Name and email are required for guest holds' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.guestEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    guestToken = randomUUID();
  }

  // Check shop capacity
  const maxHolds = parseInt(shop.max_active_holds ?? '50');
  const activeCount = await findOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM holds
     WHERE shop_id = ? AND status IN ('requested', 'confirmed')`,
    [shop.id]
  );
  if (parseInt(activeCount?.count ?? '0') >= maxHolds) {
    return NextResponse.json({ error: 'Shop hold queue is full' }, { status: 422 });
  }

  const expiryHours = parseInt(shop.request_expiry_hours ?? '24');
  const holdId = randomUUID();

  await run(
    `INSERT INTO holds (
       id, collector_user_id, guest_name, guest_email, guest_token,
       shop_id, inventory_item_id,
       card_name, scryfall_id, set_code, collector_number, condition, foil, price_cents,
       status, collector_note, pickup_window,
       request_expires_at, created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?,
       ?, ?,
       ?, ?, ?, ?, ?, ?, ?,
       'requested', ?, ?,
       NOW() + INTERVAL '${expiryHours} hours', NOW(), NOW()
     )`,
    [
      holdId,
      userId ?? null,
      userId ? null : body.guestName!.trim(),
      userId ? null : body.guestEmail!.trim().toLowerCase(),
      guestToken,
      shop.id, item.id,
      item.card_name, item.scryfall_id, item.set_code, item.collector_number,
      item.condition, item.foil, parseInt(item.price_cents),
      body.collectorNote?.trim() ?? null,
      body.pickupWindow?.trim() ?? null,
    ]
  );

  // Notify shop owner
  const guestLabel = userId ? null : `${body.guestName} (${body.guestEmail})`;
  const smsBody = holdRequestedSms(
    {
      cardName: item.card_name,
      condition: item.condition,
      foil: item.foil,
      priceCents: parseInt(item.price_cents),
      pickupWindow: body.pickupWindow,
      collectorNote: body.collectorNote,
      holdId,
    },
    shop.name,
    shop.address ?? undefined
  );

  await notifyShopOwner(shop.id, shop.user_id, 'hold_requested', {
    title: 'New hold request',
    body: `${item.card_name} (${item.condition}) — ${guestLabel ?? 'collector'}`,
    holdId,
    ctaUrl: '/shop/holds',
  }, smsBody);

  await run(
    `UPDATE holds SET shop_notified_app_at = NOW(), shop_notified_sms_at = NOW() WHERE id = ?`,
    [holdId]
  );

  return NextResponse.json({ ok: true, holdId, guestToken });
}
