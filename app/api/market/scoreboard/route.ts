import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getScoreboard, type ScoreboardDirection, type ScoreboardSort } from '@/lib/market';

const DIRECTIONS: ScoreboardDirection[] = ['bullish', 'bearish', 'neutral'];
const SORTS: ScoreboardSort[] = ['confidence', 'price'];

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const params = new URL(req.url).searchParams;
    const direction = DIRECTIONS.includes(params.get('direction') as ScoreboardDirection)
      ? (params.get('direction') as ScoreboardDirection) : 'bullish';
    const sort = SORTS.includes(params.get('sort') as ScoreboardSort)
      ? (params.get('sort') as ScoreboardSort) : 'confidence';

    const { rows, timedOut } = await getScoreboard(direction, sort);
    return NextResponse.json({ rows, timedOut });
  } catch (e) {
    console.error('GET /api/market/scoreboard failed:', e);
    return NextResponse.json({ error: 'Failed to load scoreboard' }, { status: 500 });
  }
}
