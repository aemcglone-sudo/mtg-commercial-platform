import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getSets } from '@/lib/scryfall';

/** All Scryfall sets, restricted to the kinds worth tracking as a "market" —
 * expansions/core sets/masters/commander products, not tokens/memorabilia/art series. */
const TRACKED_SET_TYPES = new Set([
  'expansion', 'core', 'masters', 'commander', 'draft_innovation', 'funny', 'starter',
]);

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sets = await getSets();
    // ?all=1 returns every set Scryfall knows about (promos, memorabilia, art series
    // included) — used to resolve a code to its full name for any printing that shows
    // up in price data, since a card's promo/special printing is still a real printing.
    // The default (curated) list is what the "browse sets" page shows to watch.
    const includeAll = req.nextUrl.searchParams.get('all') === '1';
    const filtered = sets
      .filter(s => (includeAll || TRACKED_SET_TYPES.has(s.set_type)) && s.card_count > 0)
      .sort((a, b) => (b.released_at ?? '').localeCompare(a.released_at ?? ''))
      .map(s => ({ code: s.code, name: s.name, setType: s.set_type, releasedAt: s.released_at ?? null, cardCount: s.card_count, iconSvgUri: s.icon_svg_uri ?? null }));
    return NextResponse.json({ sets: filtered });
  } catch (e) {
    console.error('GET /api/market/sets failed:', e);
    return NextResponse.json({ error: 'Failed to load sets' }, { status: 500 });
  }
}
