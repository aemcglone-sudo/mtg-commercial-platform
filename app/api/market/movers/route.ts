import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getSetMovers, getCardMovers } from '@/lib/market';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 7));
    const type = req.nextUrl.searchParams.get('type') === 'card' ? 'card' : 'set';

    if (type === 'card') {
      const [gainersRes, losersRes] = await Promise.all([
        getCardMovers(days, 20, 'gainers'),
        getCardMovers(days, 20, 'losers'),
      ]);
      return NextResponse.json({
        gainers: gainersRes.movers,
        losers: losersRes.movers,
        degraded: gainersRes.degraded || losersRes.degraded,
      });
    }

    const { movers: sets, degraded } = await getSetMovers(days, 200);
    const gainers = sets.filter(s => s.changePercent > 0).slice(0, 20);
    const losers = [...sets].reverse().filter(s => s.changePercent < 0).slice(0, 20);
    return NextResponse.json({ gainers, losers, degraded });
  } catch (e) {
    console.error('GET /api/market/movers failed:', e);
    return NextResponse.json({ error: 'Failed to load movers' }, { status: 500 });
  }
}
