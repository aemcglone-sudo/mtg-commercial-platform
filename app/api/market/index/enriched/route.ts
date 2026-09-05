import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getIndexHistory, getIndexVolatility } from '@/lib/market-index';
import { getCachedSetMovers } from '@/lib/market';

function concentrationHealth(top10Pct: number | null): 'healthy' | 'moderate' | 'risky' | null {
  if (top10Pct === null) return null;
  return top10Pct < 15 ? 'healthy' : top10Pct < 25 ? 'moderate' : 'risky';
}

function breadthHealth(advancers: number | null, decliners: number | null): 'healthy' | 'balanced' | 'weak' | null {
  if (advancers === null || decliners === null || advancers + decliners === 0) return null;
  const ratio = advancers / (advancers + decliners);
  return ratio > 0.55 ? 'healthy' : ratio > 0.45 ? 'balanced' : 'weak';
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [history, volatility, setMovers90d] = await Promise.all([
      getIndexHistory(),
      getIndexVolatility(),
      getCachedSetMovers(90),
    ]);

    const latest = history.length > 0 ? history[history.length - 1] : null;

    return NextResponse.json({
      latest,
      volatility,
      concentrationHealth: latest ? concentrationHealth(latest.concentrationTop10Pct) : null,
      breadthHealth: latest ? breadthHealth(latest.advancers, latest.decliners) : null,
      leadingSets: setMovers90d.gainers.slice(0, 5),
      laggingSets: setMovers90d.losers.slice(0, 5),
    });
  } catch (e) {
    console.error('GET /api/market/index/enriched failed:', e);
    return NextResponse.json({ error: 'Failed to load enriched index' }, { status: 500 });
  }
}
