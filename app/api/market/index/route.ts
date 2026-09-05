import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getIndexHistory } from '@/lib/market-index';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const points = await getIndexHistory();
    return NextResponse.json({ points });
  } catch (e) {
    console.error('GET /api/market/index failed:', e);
    return NextResponse.json({ error: 'Failed to load market index' }, { status: 500 });
  }
}
