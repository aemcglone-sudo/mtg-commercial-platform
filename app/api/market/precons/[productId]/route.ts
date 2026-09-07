import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedPreconValue } from '@/lib/precon';

export async function GET(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { productId } = await params;
    const { value, computedAt } = await getCachedPreconValue(productId);
    return NextResponse.json({ value, computedAt });
  } catch (e) {
    console.error('GET /api/market/precons/[productId] failed:', e);
    return NextResponse.json({ error: 'Failed to load precon value' }, { status: 500 });
  }
}
