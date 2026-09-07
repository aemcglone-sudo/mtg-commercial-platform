import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedFoilPremium } from '@/lib/market';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { table, computedAt } = await getCachedFoilPremium();
    return NextResponse.json({ table, computedAt });
  } catch (e) {
    console.error('GET /api/market/foil-premium failed:', e);
    return NextResponse.json({ error: 'Failed to load foil premium data' }, { status: 500 });
  }
}
