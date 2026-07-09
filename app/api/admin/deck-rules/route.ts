import { NextRequest, NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export interface DeckRule {
  id: string;
  rule_text: string;
  category: string;
  scope: string;
  enforcement: 'hard' | 'soft';
  active: boolean;
  sort_order: number;
  notes: string | null;
}

export async function GET(req: NextRequest) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rules = await findMany<DeckRule>(
    `SELECT id, rule_text, category, scope, enforcement, active, sort_order, notes
     FROM deck_rules ORDER BY scope, sort_order, category`
  );
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json() as Partial<DeckRule>;
  const id = randomUUID();
  await run(
    `INSERT INTO deck_rules (id, rule_text, category, scope, enforcement, active, sort_order, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, body.rule_text ?? '', body.category ?? 'general', body.scope ?? 'all',
     body.enforcement ?? 'soft', body.active ?? true, body.sort_order ?? 0, body.notes ?? null]
  );
  return NextResponse.json({ id });
}
