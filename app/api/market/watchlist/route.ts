import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getWatchlist, addCardToWatchlist, addSetToWatchlist } from '@/lib/market';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const items = await getWatchlist(userId);
    return NextResponse.json({ items });
  } catch (e) {
    console.error('GET /api/market/watchlist failed:', e);
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (body.kind === 'card') {
      if (!body.scryfallId || !body.cardName) {
        return NextResponse.json({ error: 'scryfallId and cardName required' }, { status: 400 });
      }
      await addCardToWatchlist(userId, body.scryfallId, body.cardName);
    } else if (body.kind === 'set') {
      if (!body.setCode || !body.setName) {
        return NextResponse.json({ error: 'setCode and setName required' }, { status: 400 });
      }
      await addSetToWatchlist(userId, body.setCode, body.setName);
    } else {
      return NextResponse.json({ error: 'kind must be "card" or "set"' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST /api/market/watchlist failed:', e);
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 });
  }
}
