import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getLatestPrediction } from '@/lib/market';

export async function GET(req: NextRequest, { params }: { params: Promise<{ scryfallId: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scryfallId } = await params;
    const prediction = await getLatestPrediction(scryfallId);
    return NextResponse.json({ prediction });
  } catch (e) {
    console.error('GET /api/market/card/[scryfallId]/prediction failed:', e);
    return NextResponse.json({ error: 'Failed to load prediction' }, { status: 500 });
  }
}
