import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCardHistory } from '@/lib/market';

export async function GET(req: NextRequest, { params }: { params: Promise<{ scryfallId: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scryfallId } = await params;
    const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 90));
    const points = await getCardHistory(scryfallId, days);
    return NextResponse.json({ points });
  } catch (e) {
    console.error('GET /api/market/card/[scryfallId]/history failed:', e);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
