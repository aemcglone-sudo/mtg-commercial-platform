import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCardEvents } from '@/lib/card-news';

export async function GET(req: NextRequest, { params }: { params: Promise<{ scryfallId: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scryfallId } = await params;
    const events = await getCardEvents(scryfallId);
    return NextResponse.json({ events });
  } catch (e) {
    console.error('GET /api/market/card/[scryfallId]/events failed:', e);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}
