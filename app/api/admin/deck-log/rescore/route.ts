import { NextRequest, NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { scoreDeck } from '@/app/api/deck-wizard/score/route';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { deckId } = await req.json() as { deckId: string };
  if (!deckId) return NextResponse.json({ error: 'Missing deckId' }, { status: 400 });

  const deck = await findOne<{ id: string; cards: string; commander: string | null; format: string | null; archetype: string | null }>(
    `SELECT id, cards, commander, format, archetype FROM decks WHERE id = ?`,
    [deckId]
  );
  if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const cards = JSON.parse(deck.cards ?? '{}') as Record<string, number>;
  const result = await scoreDeck({
    cards,
    commander: deck.commander ?? undefined,
    commanderColorIdentity: [],
    format: deck.format ?? 'commander',
    archetype: deck.archetype ?? undefined,
  });

  if (!result) return NextResponse.json({ error: 'Scoring failed' }, { status: 502 });

  await run(
    `UPDATE decks SET rubric_score = ?, rubric_scored_at = ? WHERE id = ?`,
    [JSON.stringify(result), new Date().toISOString(), deckId]
  );

  return NextResponse.json({ ok: true, score: result });
}
