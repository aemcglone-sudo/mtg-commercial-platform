import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';
import { randomUUID } from 'crypto';

interface Session {
  id: string; user_id: string; format: string; archetype: string | null;
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId, deckName, cards, format: bodyFormat, archetype: bodyArchetype } = await req.json() as {
    sessionId?: string;
    deckName: string;
    cards: Record<string, number>;
    format?: string;
    archetype?: string;
    commander?: string;
  };

  if (!deckName || !cards || Object.keys(cards).length === 0) {
    return NextResponse.json({ error: 'deckName and cards are required' }, { status: 400 });
  }

  // Try to get session data; fall back to body params if session doesn't exist
  let format = bodyFormat ?? 'commander';
  let archetype = bodyArchetype ?? null;

  if (sessionId) {
    const session = await findOne<Session>(
      `SELECT * FROM deck_wizard_sessions WHERE id = ? AND user_id = ?`,
      [sessionId, userId]
    ).catch(() => null);

    if (session) {
      format = session.format;
      archetype = session.archetype;
    }
  }

  const deckId = randomUUID();
  await run(
    `INSERT INTO decks (id, "userId", name, format, strategy, cards, "deckType", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?, 'paper', NOW(), NOW())`,
    [deckId, userId, deckName, format, archetype ?? null, JSON.stringify(cards)]
  );

  // Best-effort: mark session completed if we have one
  if (sessionId) {
    await run(
      `UPDATE deck_wizard_sessions SET status = 'completed', result_deck_id = ?, updated_at = NOW() WHERE id = ?`,
      [deckId, sessionId]
    ).catch(() => {});
  }

  return NextResponse.json({ deckId, ok: true });
}
