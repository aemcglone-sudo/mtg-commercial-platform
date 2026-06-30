import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface HoldRow {
  id: string; status: string; card_name: string; scryfall_id: string;
  condition: string; foil: boolean; price_cents: string; collector_note: string;
  pickup_window: string; shop_note: string; confirmed_at: string; request_expires_at: string;
  pickup_expires_at: string; created_at: string;
  collector_name: string; collector_email: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ holds: {} });

  const rows = await findMany<HoldRow>(
    `SELECT h.id, h.status, h.card_name, h.scryfall_id, h.condition, h.foil,
            h.price_cents::text, h.collector_note, h.pickup_window, h.shop_note,
            h.confirmed_at::text, h.request_expires_at::text, h.pickup_expires_at::text,
            h.created_at::text,
            u.name AS collector_name, u.email AS collector_email
     FROM holds h
     LEFT JOIN users u ON u.id = h.collector_user_id
     WHERE h.shop_id = ?
     ORDER BY h.created_at DESC`,
    [shop.id]
  );

  const mapped = rows.map(r => ({
    id: r.id,
    status: r.status,
    cardName: r.card_name,
    scryfallId: r.scryfall_id,
    condition: r.condition,
    foil: r.foil,
    priceCents: parseInt(r.price_cents),
    collectorNote: r.collector_note,
    pickupWindow: r.pickup_window,
    shopNote: r.shop_note,
    confirmedAt: r.confirmed_at,
    expiresAt: r.request_expires_at,
    pickupExpiresAt: r.pickup_expires_at,
    createdAt: r.created_at,
    collectorName: r.collector_name,
    collectorEmail: r.collector_email,
  }));

  const grouped: Record<string, typeof mapped> = {
    requested: [], confirmed: [], completed: [], declined: [], expired: [], cancelled: [],
  };
  for (const row of mapped) {
    if (grouped[row.status]) grouped[row.status].push(row);
  }

  return NextResponse.json({ holds: grouped });
}
