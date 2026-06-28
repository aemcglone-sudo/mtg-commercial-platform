import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';

interface Snapshot {
  price_cents: number | null;
  foil_price_cents: number | null;
  captured_at: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scryfallId = searchParams.get('scryfallId');
  if (!scryfallId) return NextResponse.json({ error: 'scryfallId required' }, { status: 400 });
  const clientUsd = searchParams.get('usd');
  const clientUsdFoil = searchParams.get('usdFoil');

  // Get latest snapshot
  const latest = await findOne<Snapshot>(
    `SELECT "priceCents" as price_cents, "foilPriceCents" as foil_price_cents, "capturedAt" as captured_at
     FROM card_price_snapshots
     WHERE "scryfallId" = ?
     ORDER BY "capturedAt" DESC LIMIT 1`,
    [scryfallId]
  );

  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const needsFetch = !latest || latest.captured_at < sixHoursAgo;

  let tcgCents = latest?.price_cents ?? null;
  let foilCents = latest?.foil_price_cents ?? null;

  if (needsFetch) {
    // Use client-supplied prices if available (avoids server-side Scryfall fetch)
    if (clientUsd) {
      tcgCents = Math.round(parseFloat(clientUsd) * 100);
      foilCents = clientUsdFoil ? Math.round(parseFloat(clientUsdFoil) * 100) : null;
    } else {
      try {
        const res = await fetch(`https://api.scryfall.com/cards/${scryfallId}`);
        if (res.ok) {
          const card = await res.json() as { prices?: { usd?: string | null; usd_foil?: string | null } };
          const usd = card.prices?.usd;
          const usdFoil = card.prices?.usd_foil;
          tcgCents = usd ? Math.round(parseFloat(usd) * 100) : null;
          foilCents = usdFoil ? Math.round(parseFloat(usdFoil) * 100) : null;
        }
      } catch {
        // use cached value
      }
    }

    if (tcgCents != null) {
      try {
        await run(
          `INSERT INTO card_price_snapshots (id, "scryfallId", "priceCents", "foilPriceCents", "capturedAt")
           VALUES (?, ?, ?, ?, NOW())`,
          [randomUUID(), scryfallId, tcgCents, foilCents]
        );
      } catch { /* non-fatal */ }
    }
  }

  // Compute 7-day trend
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const oldest = await findOne<Snapshot>(
    `SELECT "priceCents" as price_cents, "capturedAt" as captured_at
     FROM card_price_snapshots
     WHERE "scryfallId" = ? AND "capturedAt" >= ?
     ORDER BY "capturedAt" ASC LIMIT 1`,
    [scryfallId, sevenDaysAgo]
  );

  let trendPct7d: number | null = null;
  let trendDirection: 'up' | 'down' | 'stable' = 'stable';

  if (oldest?.price_cents && tcgCents) {
    trendPct7d = Math.round(((tcgCents - oldest.price_cents) / oldest.price_cents) * 100 * 10) / 10;
    if (trendPct7d > 2) trendDirection = 'up';
    else if (trendPct7d < -2) trendDirection = 'down';
  }

  return NextResponse.json({ tcgCents, foilCents, trendPct7d, trendDirection });
}
