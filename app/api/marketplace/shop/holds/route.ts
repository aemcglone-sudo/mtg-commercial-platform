import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface HoldRow {
  id: string; status: string; card_name: string; scryfall_id: string;
  condition: string; foil: boolean; price_cents: string; collector_note: string;
  pickup_window: string; shop_note: string; confirmed_at: string; request_expires_at: string;
  pickup_expires_at: string; created_at: string; collector_user_id: string;
  source_campaign_id: string; hold_group_id: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE user_id = ?`, [userId]);
  if (!shop) return NextResponse.json({ holds: {} });

  const rows = await findMany<HoldRow>(
    `SELECT id, status, card_name, scryfall_id, condition, foil,
            price_cents::text, collector_note, pickup_window, shop_note,
            confirmed_at::text, request_expires_at::text, pickup_expires_at::text,
            created_at::text, collector_user_id, source_campaign_id, hold_group_id
     FROM holds WHERE shop_id = ?
     ORDER BY created_at DESC`,
    [shop.id]
  );

  // Group by status
  const grouped: Record<string, typeof rows> = {
    requested: [], confirmed: [], completed: [], declined: [], expired: [], cancelled: [],
  };
  for (const row of rows) {
    if (grouped[row.status]) grouped[row.status].push(row);
  }

  return NextResponse.json({ holds: grouped });
}
