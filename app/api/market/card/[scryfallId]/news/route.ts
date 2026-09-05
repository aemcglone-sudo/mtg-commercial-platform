import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCardNews } from '@/lib/card-news';

export async function GET(req: NextRequest, { params }: { params: Promise<{ scryfallId: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scryfallId } = await params;
    const news = await getCardNews(scryfallId);
    return NextResponse.json({ news });
  } catch (e) {
    console.error('GET /api/market/card/[scryfallId]/news failed:', e);
    return NextResponse.json({ error: 'Failed to load news' }, { status: 500 });
  }
}
