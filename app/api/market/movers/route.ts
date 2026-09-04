import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedSetMovers, getCachedCardMovers } from '@/lib/market';

/** Reads precomputed gainers/losers — the actual (expensive) aggregation
 * only ever runs once a day, from the cron sync job. See lib/market.ts's
 * refreshMoversCache(). */
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 7));
    const type = req.nextUrl.searchParams.get('type') === 'card' ? 'card' : 'set';

    const { gainers, losers, computedAt } = type === 'card'
      ? await getCachedCardMovers(days)
      : await getCachedSetMovers(days);

    return NextResponse.json({ gainers, losers, computedAt, degraded: false });
  } catch (e) {
    console.error('GET /api/market/movers failed:', e);
    return NextResponse.json({ error: 'Failed to load movers' }, { status: 500 });
  }
}
