import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export const maxDuration = 60;

export interface DeckData {
  id: string;
  name: string;
  format?: string;
  strategy?: string;
  cards: Record<string, number>;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decks = await findMany<any>(
      `SELECT id, userId, name, format, strategy, cards, personaType, coreGoal, lastAnalyzed, createdAt, updatedAt FROM decks WHERE userId = ? ORDER BY createdAt DESC`,
      [userId]
    );

    const parsed = decks.map(d => ({
      ...d,
      cards: d.cards ? JSON.parse(d.cards) : {},
    }));

    return NextResponse.json(parsed);  // Returns array for backward compatibility
  } catch (err) {
    console.error('Decks fetch error:', err);
    return NextResponse.json({ error: `Failed to fetch decks: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, format, strategy, cards } = body;

  if (!name || !format) {
    return NextResponse.json(
      { error: 'Name and format are required' },
      { status: 400 }
    );
  }

  try {
    const id = randomUUID();
    const cardsJson = JSON.stringify(cards || {});

    await run(
      `INSERT INTO decks (id, userId, name, format, strategy, cards, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, userId, name, format, strategy || null, cardsJson]
    );

    return NextResponse.json({
      id,
      name,
      format,
      strategy: strategy || null,
      cards: cards || {},
    });
  } catch (err) {
    console.error('Deck creation error:', err);
    return NextResponse.json({ error: 'Failed to create deck' }, { status: 500 });
  }
}
