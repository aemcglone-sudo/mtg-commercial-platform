import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedPopularityVsPrice } from '@/lib/edhrec-tracker';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { rows, computedAt } = await getCachedPopularityVsPrice();
    return NextResponse.json({ rows, computedAt });
  } catch (e) {
    console.error('GET /api/market/popularity failed:', e);
    return NextResponse.json({ error: 'Failed to load popularity data' }, { status: 500 });
  }
}
