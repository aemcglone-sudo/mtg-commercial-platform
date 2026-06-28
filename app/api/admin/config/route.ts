import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

const CONFIG_KEY = 'mtg_deck_rules';

function defaultRules(): string {
  try {
    return readFileSync(join(process.cwd(), 'docs/mtg-formats-guide.md'), 'utf-8');
  } catch {
    return '';
  }
}

export async function GET(req: NextRequest) {
  if (!requireRole(req, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const row = await findOne<{ key: string; value: string; updated_at: string }>(
    `SELECT * FROM site_config WHERE key = ?`, [CONFIG_KEY]
  );
  return NextResponse.json({ value: row?.value ?? defaultRules(), updatedAt: row?.updated_at ?? null });
}

export async function PUT(req: NextRequest) {
  if (!requireRole(req, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { value } = await req.json() as { value: string };
  if (typeof value !== 'string') {
    return NextResponse.json({ error: 'value required' }, { status: 400 });
  }
  await run(
    `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [CONFIG_KEY, value]
  );
  return NextResponse.json({ ok: true });
}
