import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedDeckValueSummary } from '@/lib/deck-value';
import { findMany } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [{ decks: allDecks, computedAt }, ownDeckIds] = await Promise.all([
      getCachedDeckValueSummary(),
      findMany<{ id: string }>(`SELECT id FROM decks WHERE "userId" = ?`, [userId]),
    ]);
    const ownIds = new Set(ownDeckIds.map(d => d.id));
    const decks = allDecks.filter(d => ownIds.has(d.deckId));
    return NextResponse.json({ decks, computedAt });
  } catch (e) {
    console.error('GET /api/decks/value failed:', e);
    return NextResponse.json({ error: 'Failed to load deck values' }, { status: 500 });
  }
}
