import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await findOne<{ parsedData: string }>(
    'SELECT "parsedData" FROM collection_uploads WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 1',
    [userId]
  );
  const allCards: string[] = row ? JSON.parse(row.parsedData).collectionCards.map((c: { name: string }) => c.name) : [];

  const decks = await findMany<{ name: string; cards: string }>(
    'SELECT name, cards FROM decks WHERE "userId" = ?',
    [userId]
  );

  const search = req.nextUrl.searchParams.get('q') ?? '';
  const matchingCollection = search
    ? allCards.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : allCards.slice(0, 5);

  const taxAudit = decks.find(d => d.name === 'Tax Audit');
  const taxAuditCards = taxAudit ? Object.keys(JSON.parse(taxAudit.cards || '{}')) : [];
  const matchingDeck = search
    ? taxAuditCards.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : taxAuditCards.slice(0, 5);

  return NextResponse.json({
    collectionMatches: matchingCollection,
    deckMatches: matchingDeck,
    collectionTotal: allCards.length,
  });
}
