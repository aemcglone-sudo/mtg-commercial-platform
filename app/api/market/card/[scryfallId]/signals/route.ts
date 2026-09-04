import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getLatestSignal } from '@/lib/market';

export async function GET(req: NextRequest, { params }: { params: Promise<{ scryfallId: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scryfallId } = await params;
    const signal = await getLatestSignal(scryfallId);
    return NextResponse.json({ signal });
  } catch (e) {
    console.error('GET /api/market/card/[scryfallId]/signals failed:', e);
    return NextResponse.json({ error: 'Failed to load signal' }, { status: 500 });
  }
}
