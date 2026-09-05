import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedCategoryHighValue } from '@/lib/market';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { categories, computedAt } = await getCachedCategoryHighValue();
    return NextResponse.json({ categories, computedAt });
  } catch (e) {
    console.error('GET /api/market/high-value/categories failed:', e);
    return NextResponse.json({ error: 'Failed to load category breakdown' }, { status: 500 });
  }
}
