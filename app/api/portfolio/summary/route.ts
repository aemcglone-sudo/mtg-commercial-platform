import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedPortfolio } from '@/lib/portfolio';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { summary, computedAt } = await getCachedPortfolio(userId);
    return NextResponse.json({ summary, computedAt });
  } catch (e) {
    console.error('GET /api/portfolio/summary failed:', e);
    return NextResponse.json({ error: 'Failed to load portfolio' }, { status: 500 });
  }
}
