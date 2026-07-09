import { NextRequest, NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { findMany, run } from '@/lib/db';
import { geminiChat, extractJson } from '@/lib/gemini';
import { randomUUID } from 'crypto';

const VALID_CATEGORIES = ['general', 'color_identity', 'deck_size', 'singleton', 'legality', 'ratios', 'mana_curve', 'power_level', 'tribal', 'mana_base'];
const VALID_SCOPES = ['all', 'commander', 'standard', 'pioneer', 'modern', 'legacy', 'limited', 'brawl', 'collection_only'];

export interface SuggestedRule {
  rule_text: string;
  category: string;
  scope: string;
  enforcement: 'hard' | 'soft';
  notes: string;
  reasoning: string; // Khoa's explanation of why this rule was derived
}

export interface FeedbackResponse {
  summary: string;
  rules: SuggestedRule[];
}

// POST /api/admin/deck-feedback
// Body: { deckList: string; feedback: string; format?: string }
// Returns: { summary, rules } — caller reviews and commits approved rules
export async function POST(req: NextRequest) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { deckList, feedback, format } = await req.json() as {
    deckList?: string;
    feedback: string;
    format?: string;
  };

  if (!feedback?.trim()) return NextResponse.json({ error: 'feedback is required' }, { status: 400 });

  // Load existing rules so Khoa doesn't duplicate them
  const existingRules = await findMany<{ rule_text: string; category: string; scope: string }>(
    `SELECT rule_text, category, scope FROM deck_rules WHERE active = true ORDER BY sort_order`
  );
  const existingDoc = existingRules
    .map(r => `[${r.scope}/${r.category}] ${r.rule_text}`)
    .join('\n');

  const prompt = `You are Khoa, a Magic: The Gathering deck building expert. Your job is to convert playtester feedback into concrete, actionable deck building rules.

EXISTING RULES (do not duplicate these):
${existingDoc || '(none yet)'}

${deckList ? `DECK LIST THAT WAS TESTED:\n${deckList}\n` : ''}
${format ? `FORMAT: ${format}` : ''}

PLAYTESTER FEEDBACK:
${feedback}

Analyze the feedback and derive 1–5 specific, actionable deck building rules. Each rule should:
- Be a single, unambiguous instruction a deck builder can follow
- Target the root cause of the problem, not the symptom
- Apply broadly (not just to this one deck) whenever possible
- Not duplicate any existing rule above

For each rule, choose:
- category: one of ${VALID_CATEGORIES.join(', ')}
- scope: one of ${VALID_SCOPES.join(', ')} — use the most specific scope that applies
- enforcement: "hard" if breaking the rule always produces a bad deck, "soft" if it's a strong guideline

Return ONLY valid JSON:
{
  "summary": "One paragraph summarizing what went wrong and what rules will fix it",
  "rules": [
    {
      "rule_text": "The actionable rule, written as a direct instruction",
      "category": "ratios",
      "scope": "commander",
      "enforcement": "soft",
      "notes": "Context or exceptions for this rule",
      "reasoning": "Why this rule was derived from the feedback"
    }
  ]
}`;

  try {
    const raw = await geminiChat(prompt, 0.4, undefined, 4096);
    if (!raw) return NextResponse.json({ error: 'AI unavailable' }, { status: 502 });

    const parsed = JSON.parse(extractJson(raw)) as FeedbackResponse;

    // Sanitize categories/scopes to valid values
    const rules = (parsed.rules ?? []).map(r => ({
      ...r,
      category: VALID_CATEGORIES.includes(r.category) ? r.category : 'general',
      scope: VALID_SCOPES.includes(r.scope) ? r.scope : 'all',
      enforcement: r.enforcement === 'hard' ? 'hard' : 'soft',
    }));

    return NextResponse.json({ summary: parsed.summary ?? '', rules });
  } catch (e) {
    console.error('[deck-feedback]', e);
    return NextResponse.json({ error: 'Failed to process feedback' }, { status: 500 });
  }
}

// PUT /api/admin/deck-feedback
// Body: { rules: SuggestedRule[] } — commit approved rules to deck_rules table
export async function PUT(req: NextRequest) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rules } = await req.json() as { rules: SuggestedRule[] };
  if (!Array.isArray(rules) || rules.length === 0) {
    return NextResponse.json({ error: 'rules array is required' }, { status: 400 });
  }

  const ids: string[] = [];
  for (const rule of rules) {
    const id = randomUUID();
    await run(
      `INSERT INTO deck_rules (id, rule_text, category, scope, enforcement, active, sort_order, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, true, 0, ?, NOW(), NOW())`,
      [id, rule.rule_text, rule.category, rule.scope, rule.enforcement, rule.notes ?? null]
    );
    ids.push(id);
  }

  return NextResponse.json({ committed: ids.length, ids });
}
