import { NextRequest, NextResponse } from 'next/server';
import { findOne } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

function defaultRules(): string {
  try {
    return readFileSync(join(process.cwd(), 'docs/mtg-formats-guide.md'), 'utf-8');
  } catch {
    return '';
  }
}

// Cache in-process for 5 minutes so suggest-cards doesn't hit DB on every call
let cached: { value: string; at: number } | null = null;

export async function GET(req: NextRequest) {
  if (!getAuthenticatedUserId(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
    return NextResponse.json({ value: cached.value });
  }
  const row = await findOne<{ value: string }>(
    `SELECT value FROM site_config WHERE key = 'mtg_deck_rules'`
  );
  const value = row?.value ?? defaultRules();
  cached = { value, at: Date.now() };
  return NextResponse.json({ value });
}
