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
    const filtered = sets
      .filter(s => TRACKED_SET_TYPES.has(s.set_type) && s.card_count > 0)
      .sort((a, b) => (b.released_at ?? '').localeCompare(a.released_at ?? ''))
      .map(s => ({ code: s.code, name: s.name, setType: s.set_type, releasedAt: s.released_at ?? null, cardCount: s.card_count, iconSvgUri: s.icon_svg_uri ?? null }));
    return NextResponse.json({ sets: filtered });
  } catch (e) {
    console.error('GET /api/market/sets failed:', e);
    return NextResponse.json({ error: 'Failed to load sets' }, { status: 500 });
  }
}
