import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';

interface Session {
  id: string; user_id: string; status: string; entry_mode: string; format: string;
  commander_scryfall_id: string | null; partner_scryfall_id: string | null;
  archetype: string | null; themes: string[]; tribal_type: string | null;
  psychographic: string | null; budget_cents: number | null;
  natural_language_prompt: string | null; wizard_state: Record<string, unknown>;
  current_step: number; result_deck_id: string | null;
  created_at: string; updated_at: string;
}

async function getSession(id: string, userId: string) {
  return findOne<Session>(
    `SELECT * FROM deck_wizard_sessions WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const session = await getSession(id, userId);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ session });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const session = await getSession(id, userId);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as Partial<{
    format: string; current_step: number; archetype: string; themes: string[];
    tribal_type: string; psychographic: string; budget_cents: number;
    commander_scryfall_id: string; partner_scryfall_id: string;
    natural_language_prompt: string; wizard_state: Record<string, unknown>; status: string;
  }>;

  const sets: string[] = [];
  const vals: unknown[] = [];

  if (body.format !== undefined) { sets.push('"format" = ?'); vals.push(body.format); }
  if (body.current_step !== undefined) { sets.push('current_step = ?'); vals.push(body.current_step); }
  if (body.archetype !== undefined) { sets.push('archetype = ?'); vals.push(body.archetype); }
  if (body.themes !== undefined) { sets.push('themes = ?'); vals.push(body.themes as unknown as string); }
  if (body.tribal_type !== undefined) { sets.push('tribal_type = ?'); vals.push(body.tribal_type); }
  if (body.psychographic !== undefined) { sets.push('psychographic = ?'); vals.push(body.psychographic); }
  if (body.budget_cents !== undefined) { sets.push('budget_cents = ?'); vals.push(body.budget_cents); }
  if (body.commander_scryfall_id !== undefined) { sets.push('commander_scryfall_id = ?'); vals.push(body.commander_scryfall_id); }
  if (body.partner_scryfall_id !== undefined) { sets.push('partner_scryfall_id = ?'); vals.push(body.partner_scryfall_id); }
  if (body.natural_language_prompt !== undefined) { sets.push('natural_language_prompt = ?'); vals.push(body.natural_language_prompt); }
  if (body.wizard_state !== undefined) { sets.push('wizard_state = ?'); vals.push(JSON.stringify(body.wizard_state)); }
  if (body.status !== undefined) { sets.push('status = ?'); vals.push(body.status); }

  if (sets.length === 0) return NextResponse.json({ ok: true });

  sets.push('updated_at = NOW()');
  vals.push(id);

  await run(
    `UPDATE deck_wizard_sessions SET ${sets.join(', ')} WHERE id = ?`,
    vals as (string | number | boolean | null)[]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const session = await getSession(id, userId);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await run(`UPDATE deck_wizard_sessions SET status = 'abandoned', updated_at = NOW() WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
