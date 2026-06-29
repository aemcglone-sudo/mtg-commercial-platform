import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';
import { notifyShopOwner } from '@/lib/marketplace/notify';
import { holdRequestedSms } from '@/lib/marketplace/sms';

export const dynamic = 'force-dynamic';

interface InventoryRow {
  id: string; shop_id: string; card_name: string; scryfall_id: string;
  set_code: string; collector_number: string; condition: string; foil: boolean; price_cents: string;
}

interface ShopRow {
  id: string; name: string; user_id: string; request_expiry_hours: string; max_active_holds: string;
}

interface HoldRow {
  id: string; status: string; card_name: string; condition: string; foil: boolean;
  price_cents: string; request_expires_at: string; confirmed_at: string;
  pickup_expires_at: string; collector_note: string; pickup_window: string;
  shop_id: string; shop_name: string; created_at: string;
}

interface ActiveCountRow { count: string }

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(req);
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  let rows: HoldRow[];

  if (role === 'shop_owner') {
    const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE user_id = ?`, [userId]);
    if (!shop) return NextResponse.json({ holds: [] });

    rows = await findMany<HoldRow>(
      `SELECT h.id, h.status, h.card_name, h.condition, h.foil, h.price_cents::text,
              h.request_expires_at::text, h.confirmed_at::text, h.pickup_expires_at::text,
              h.collector_note, h.pickup_window, h.shop_id,
              s.name AS shop_name, h.created_at::text
       FROM holds h JOIN shops s ON s.id = h.shop_id
       WHERE h.shop_id = ? ${status ? 'AND h.status = ?' : ''}
       ORDER BY h.created_at DESC LIMIT ? OFFSET ?`,
      status ? [shop.id, status, limit, offset] : [shop.id, limit, offset]
    );
  } else {
    rows = await findMany<HoldRow>(
      `SELECT h.id, h.status, h.card_name, h.condition, h.foil, h.price_cents::text,
              h.request_expires_at::text, h.confirmed_at::text, h.pickup_expires_at::text,
              h.collector_note, h.pickup_window, h.shop_id,
              s.name AS shop_name, h.created_at::text
       FROM holds h JOIN shops s ON s.id = h.shop_id
       WHERE h.collector_user_id = ? ${status ? 'AND h.status = ?' : ''}
       ORDER BY h.created_at DESC LIMIT ? OFFSET ?`,
      status ? [userId, status, limit, offset] : [userId, limit, offset]
    );
  }

  return NextResponse.json({ holds: rows, page });
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    inventoryItemId: string;
    collectorNote?: string;
    pickupWindow?: string;
    sourceDeckId?: string;
    sourceListId?: string;
    sourceCampaignId?: string;
  };

  if (!body.inventoryItemId) {
    return NextResponse.json({ error: 'inventoryItemId required' }, { status: 400 });
  }

  // Enforce 10 active hold limit per collector
  const activeCount = await findOne<ActiveCountRow>(
    `SELECT COUNT(*)::text AS count FROM holds WHERE collector_user_id = ? AND status IN ('requested','confirmed')`,
    [userId]
  );
  if (parseInt(activeCount?.count ?? '0') >= 10) {
    return NextResponse.json({ error: 'You have reached the maximum of 10 active holds' }, { status: 422 });
  }

  const item = await findOne<InventoryRow>(
    `SELECT id, "shopId" AS shop_id, "cardName" AS card_name, "scryfallId" AS scryfall_id,
            "setCode" AS set_code, "collectorNumber" AS collector_number, condition, foil, "priceCents"::text AS price_cents
     FROM shop_inventory WHERE id = ? AND quantity > 0`,
    [body.inventoryItemId]
  );
  if (!item) return NextResponse.json({ error: 'Item not found or out of stock' }, { status: 404 });

  // Get shop + prefs
  const shop = await findOne<ShopRow>(
    `SELECT s.id, s.name, s.user_id,
            COALESCE(snp.request_expiry_hours, 24)::text AS request_expiry_hours,
            COALESCE(snp.max_active_holds, 50)::text AS max_active_holds
     FROM shops s
     LEFT JOIN shop_notification_prefs snp ON snp.shop_id = s.id
     WHERE s.id = ?`,
    [item.shop_id]
  );
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Enforce shop hold limit
  const shopActiveCount = await findOne<ActiveCountRow>(
    `SELECT COUNT(*)::text AS count FROM holds WHERE shop_id = ? AND status IN ('requested','confirmed')`,
    [shop.id]
  );
  if (parseInt(shopActiveCount?.count ?? '0') >= parseInt(shop.max_active_holds)) {
    return NextResponse.json({ error: 'This shop has reached their hold capacity' }, { status: 422 });
  }

  const expiryHours = parseInt(shop.request_expiry_hours);
  const requestExpiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();
  const holdId = randomUUID();

  await run(
    `INSERT INTO holds
       (id, collector_user_id, shop_id, inventory_item_id,
        card_name, scryfall_id, set_code, collector_number, condition, foil, price_cents,
        collector_note, pickup_window, request_expires_at,
        source_deck_id, source_list_id, source_campaign_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      holdId, userId, shop.id, item.id,
      item.card_name, item.scryfall_id, item.set_code, item.collector_number ?? null,
      item.condition, item.foil, parseInt(item.price_cents),
      body.collectorNote ?? null, body.pickupWindow ?? null, requestExpiresAt,
      body.sourceDeckId ?? null, body.sourceListId ?? null, body.sourceCampaignId ?? null,
    ]
  );

  // Notify shop owner
  const smsBody = holdRequestedSms(
    {
      cardName: item.card_name, condition: item.condition, foil: item.foil,
      priceCents: parseInt(item.price_cents), pickupWindow: body.pickupWindow,
      collectorNote: body.collectorNote, holdId,
    },
    shop.name
  );

  await notifyShopOwner(shop.id, shop.user_id, 'hold_requested', {
    title: 'New hold request',
    body: `${item.card_name} (${item.condition}) · $${(parseInt(item.price_cents) / 100).toFixed(2)}${body.pickupWindow ? ` · ${body.pickupWindow}` : ''}`,
    holdId,
    ctaUrl: `/shop/holds/${holdId}`,
  }, smsBody);

  await run(`UPDATE holds SET shop_notified_app_at = NOW(), shop_notified_sms_at = NOW() WHERE id = ?`, [holdId]);

  return NextResponse.json({ ok: true, holdId });
}
