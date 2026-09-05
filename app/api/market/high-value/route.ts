import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedHighValueCards } from '@/lib/market';
import { findMany } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { cards, computedAt } = await getCachedHighValueCards();

    // Any logged news for these specific cards — cheap (market_card_events
    // is small), so fine to do live rather than folding into the cache.
    const ids = cards.map(c => c.scryfallId);
    const events = ids.length > 0
      ? await findMany<any>(
          `SELECT scryfall_id as "scryfallId", category, summary, source_urls as "sourceUrls", detected_at as "detectedAt"
           FROM market_card_events WHERE scryfall_id = ANY(?) ORDER BY detected_at DESC`,
          [ids as any]
        )
      : [];
    const eventsByCard = new Map<string, any[]>();
    for (const e of events) {
      const arr = eventsByCard.get(e.scryfallId) ?? [];
      arr.push(e);
      eventsByCard.set(e.scryfallId, arr);
    }

    const enriched = cards.map(c => ({ ...c, latestEvent: eventsByCard.get(c.scryfallId)?.[0] ?? null }));

    return NextResponse.json({ cards: enriched, computedAt });
  } catch (e) {
    console.error('GET /api/market/high-value failed:', e);
    return NextResponse.json({ error: 'Failed to load high value cards' }, { status: 500 });
  }
}
