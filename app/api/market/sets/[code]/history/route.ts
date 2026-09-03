import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getSetHistory } from '@/lib/market';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { code } = await params;
    const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 90));
    const points = await getSetHistory(code, days);
    return NextResponse.json({ points });
  } catch (e) {
    console.error('GET /api/market/sets/[code]/history failed:', e);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
