import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { removeFromWatchlist } from '@/lib/market';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    await removeFromWatchlist(userId, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/market/watchlist/[id] failed:', e);
    return NextResponse.json({ error: 'Failed to remove' }, { status: 500 });
  }
}
