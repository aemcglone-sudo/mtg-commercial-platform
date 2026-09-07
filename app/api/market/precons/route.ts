import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedPreconValueSummary } from '@/lib/precon';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { products, computedAt } = await getCachedPreconValueSummary();
    return NextResponse.json({ products, computedAt });
  } catch (e) {
    console.error('GET /api/market/precons failed:', e);
    return NextResponse.json({ error: 'Failed to load precon values' }, { status: 500 });
  }
}
