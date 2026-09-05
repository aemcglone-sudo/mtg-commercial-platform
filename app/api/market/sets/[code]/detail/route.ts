import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getSetTopCards } from '@/lib/market';
import { getSetEvents } from '@/lib/card-news';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { code } = await params;
    const [topCards, events] = await Promise.all([
      getSetTopCards(code, 10),
      getSetEvents(code, 5),
    ]);
    return NextResponse.json({ topCards, events });
  } catch (e) {
    console.error('GET /api/market/sets/[code]/detail failed:', e);
    return NextResponse.json({ error: 'Failed to load set detail' }, { status: 500 });
  }
}
