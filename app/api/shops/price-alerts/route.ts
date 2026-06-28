import { NextRequest, NextResponse } from 'next/server';
import { findMany, findOne } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

export interface PriceAlert {
  scryfallId: string;
  cardName: string;
  currentCents: number;
  prevCents: number;
  delta: number;
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ up: [], down: [] });

  // Get unique scryfallIds in this shop's inventory
  const inventory = await findMany<{ scryfallId: string }>(
    'SELECT DISTINCT "scryfallId" FROM shop_inventory WHERE "shopId" = ? AND "scryfallId" IS NOT NULL',
    [shopId]
  );
  if (inventory.length === 0) return NextResponse.json({ up: [], down: [] });

  const ids = inventory.map(r => r.scryfallId);
  const cutoff48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  // For each scryfallId, get the latest and the oldest snapshot in the last 48h
  // We need two snapshots per card: newest and oldest within 48h window
  // Use a CTE to avoid N+1 queries
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');

  // Build query manually since our db util handles ? → $N translation
  const alerts = await findMany<{
    scryfallId: string;
    cardName: string;
    currentCents: number;
    prevCents: number;
  }>(
    `WITH latest AS (
       SELECT DISTINCT ON ("scryfallId") "scryfallId", "cardName", "priceCents" as current_cents
       FROM card_price_snapshots
       WHERE "scryfallId" IN (${ids.map(() => '?').join(', ')})
         AND "priceCents" IS NOT NULL
       ORDER BY "scryfallId", "capturedAt" DESC
     ),
     oldest AS (
       SELECT DISTINCT ON ("scryfallId") "scryfallId", "priceCents" as prev_cents
       FROM card_price_snapshots
       WHERE "scryfallId" IN (${ids.map(() => '?').join(', ')})
         AND "capturedAt" >= ?
         AND "priceCents" IS NOT NULL
       ORDER BY "scryfallId", "capturedAt" ASC
     )
     SELECT l."scryfallId", l."cardName", l.current_cents as "currentCents", o.prev_cents as "prevCents"
     FROM latest l
     JOIN oldest o ON o."scryfallId" = l."scryfallId"
     WHERE l.current_cents != o.prev_cents`,
    [...ids, ...ids, cutoff48h]
  );

  const up: PriceAlert[] = [];
  const down: PriceAlert[] = [];

  for (const row of alerts) {
    if (!row.prevCents || !row.currentCents) continue;
    const delta = ((row.currentCents - row.prevCents) / row.prevCents) * 100;
    if (Math.abs(delta) < 15) continue;
    const alert: PriceAlert = {
      scryfallId: row.scryfallId,
      cardName: row.cardName,
      currentCents: row.currentCents,
      prevCents: row.prevCents,
      delta,
    };
    if (delta > 0) up.push(alert);
    else down.push(alert);
  }

  up.sort((a, b) => b.delta - a.delta);
  down.sort((a, b) => a.delta - b.delta);

  return NextResponse.json({ up, down });
}
