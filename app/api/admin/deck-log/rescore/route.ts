import { NextRequest, NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { deckId } = await req.json() as { deckId: string };
  if (!deckId) return NextResponse.json({ error: 'Missing deckId' }, { status: 400 });

  const deck = await findOne<{ id: string; cards: string; commander: string | null; format: string | null; archetype: string | null; userId: string }>(
    `SELECT id, cards, commander, format, archetype, "userId" FROM decks WHERE id = ?`,
    [deckId]
  );
  if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Call the score API internally (reuse the same endpoint, passing a fake cookie)
  const scoreRes = await fetch(`${req.nextUrl.origin}/api/deck-wizard/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: req.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      cards: JSON.parse(deck.cards ?? '{}') as Record<string, number>,
      commander: deck.commander,
      commanderColorIdentity: [],
      format: deck.format ?? 'commander',
      archetype: deck.archetype,
      themes: [],
    }),
  });

  if (!scoreRes.ok) {
    return NextResponse.json({ error: 'Scoring failed' }, { status: 502 });
  }

  const scoreData = await scoreRes.json() as Record<string, unknown>;

  await run(
    `UPDATE decks SET rubric_score = ?, rubric_scored_at = ? WHERE id = ?`,
    [JSON.stringify(scoreData), new Date().toISOString(), deckId]
  );

  return NextResponse.json({ ok: true, score: scoreData });
}
