import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

interface StaleRow {
  id: string;
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ ids: [] });

  // Cards where price hasn't been updated in 30 days AND market has moved >10%
  const rows = await findMany<StaleRow>(
    `SELECT si.id
     FROM shop_inventory si
     JOIN LATERAL (
       SELECT "priceCents" as market_cents
       FROM card_price_snapshots
       WHERE "scryfallId" = si."scryfallId"
       ORDER BY "capturedAt" DESC
       LIMIT 1
     ) snap ON true
     WHERE si."shopId" = ?
       AND si.quantity > 0
       AND (si.price_updated_at IS NULL OR si.price_updated_at < NOW() - INTERVAL '30 days')
       AND snap.market_cents > 0
       AND ABS(snap.market_cents::float - si."priceCents"::float) / snap.market_cents::float > 0.10`,
    [shop.id]
  );

  return NextResponse.json({ ids: rows.map(r => r.id) });
}
