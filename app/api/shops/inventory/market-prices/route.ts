import { NextRequest, NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { findMany, run } from '@/lib/db';

export interface MarketPrice {
  usd: number | null;
  usdFoil: number | null;
  eur: number | null;
  eurFoil: number | null;
}

// GET /api/shops/inventory/market-prices?ids=id1,id2,id3
// Returns cached snapshot prices, flags which are stale (>6h old)
export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ids = req.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json({ prices: {}, stale: [] });

  // Get latest snapshot per scryfallId
  const rows = await findMany<{ scryfall_id: string; price_cents: number; foil_price_cents: number | null; captured_at: string }>(
    `SELECT DISTINCT ON ("scryfallId") "scryfallId" as scryfall_id, "priceCents" as price_cents, "foilPriceCents" as foil_price_cents, "capturedAt" as captured_at
     FROM card_price_snapshots
     WHERE "scryfallId" = ANY(ARRAY[${ids.map((_, i) => `$${i + 1}`).join(',')}]::text[])
     ORDER BY "scryfallId", "capturedAt" DESC`,
    ids
  );

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const now = Date.now();
  const prices: Record<string, MarketPrice> = {};
  const stale: string[] = [];
  const found = new Set<string>();

  for (const row of rows) {
    found.add(row.scryfall_id);
    prices[row.scryfall_id] = {
      usd: row.price_cents,
      usdFoil: row.foil_price_cents ?? null,
      eur: null,
      eurFoil: null,
    };
    if (now - new Date(row.captured_at).getTime() > SIX_HOURS) {
      stale.push(row.scryfall_id);
    }
  }

  // IDs with no snapshot at all are also "stale"
  for (const id of ids) {
    if (!found.has(id)) stale.push(id);
  }

  return NextResponse.json({ prices, stale });
}

// POST /api/shops/inventory/market-prices
// Body: { prices: Record<scryfallId, { usd: number|null, usdFoil: number|null }> }
// Saves prices as snapshots
export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { prices } = await req.json() as {
    prices: Record<string, { usd: number | null; usdFoil: number | null }>
  };

  const now = new Date().toISOString();
  for (const [scryfallId, p] of Object.entries(prices)) {
    if (!p.usd && !p.usdFoil) continue;
    await run(
      `INSERT INTO card_price_snapshots (id, "scryfallId", "priceCents", "foilPriceCents", "capturedAt")
       VALUES (gen_random_uuid()::text, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [scryfallId, p.usd ?? 0, p.usdFoil ?? null, now]
    );
  }

  return NextResponse.json({ ok: true });
}
