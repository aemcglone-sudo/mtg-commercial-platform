import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getPrintings } from '@/lib/market';

export async function GET(req: NextRequest, { params }: { params: Promise<{ scryfallId: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scryfallId } = await params;
    const printings = await getPrintings(scryfallId);
    return NextResponse.json({ printings });
  } catch (e) {
    console.error('GET /api/market/card/[scryfallId]/printings failed:', e);
    return NextResponse.json({ error: 'Failed to load printings' }, { status: 500 });
  }
}
