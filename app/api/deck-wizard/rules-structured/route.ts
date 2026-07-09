import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

// In-process cache: 5 minutes
let cache: { text: string; at: number } | null = null;

export async function GET(req: NextRequest) {
  if (!getAuthenticatedUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return NextResponse.json({ rules: cache.text });

  const rows = await findMany<{ rule_text: string; category: string; scope: string; enforcement: string }>(
    `SELECT rule_text, category, scope, enforcement FROM deck_rules
     WHERE active = true ORDER BY scope, sort_order, category`
  );

  // Format as structured prompt text grouped by scope
  const byScope: Record<string, string[]> = {};
  for (const r of rows) {
    const key = `${r.scope}|${r.enforcement}`;
    if (!byScope[key]) byScope[key] = [];
    byScope[key].push(`- [${r.category}] ${r.rule_text}`);
  }

  const sections: string[] = [];
  const scopes = [...new Set(rows.map(r => r.scope))];
  for (const scope of scopes) {
    const hardRules = byScope[`${scope}|hard`] ?? [];
    const softRules = byScope[`${scope}|soft`] ?? [];
    const lines: string[] = [];
    if (hardRules.length) lines.push(`HARD RULES (must be followed exactly):\n${hardRules.join('\n')}`);
    if (softRules.length) lines.push(`GUIDELINES (strong recommendations):\n${softRules.join('\n')}`);
    if (lines.length) sections.push(`### ${scope.toUpperCase()}\n${lines.join('\n\n')}`);
  }

  const text = sections.join('\n\n---\n\n');
  cache = { text, at: Date.now() };
  return NextResponse.json({ rules: text });
}
