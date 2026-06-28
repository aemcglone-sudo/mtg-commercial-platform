import { NextRequest, NextResponse } from 'next/server';
import { findMany, run } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { entryMode: string; format: string };
  if (!body.entryMode || !body.format) {
    return NextResponse.json({ error: 'entryMode and format are required' }, { status: 400 });
  }

  const id = randomUUID();
  await run(
    `INSERT INTO deck_wizard_sessions (id, user_id, entry_mode, format, status, current_step, wizard_state, themes, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'in_progress', 1, '{}', '{}', NOW(), NOW())`,
    [id, userId, body.entryMode, body.format]
  );

  return NextResponse.json({ id });
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') ?? 'in_progress';
  const sessions = await findMany<{ id: string; format: string; current_step: number; updated_at: string }>(
    `SELECT id, format, archetype, current_step, updated_at FROM deck_wizard_sessions
     WHERE user_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 5`,
    [userId, status]
  );

  return NextResponse.json({ sessions });
}
