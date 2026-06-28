import { NextRequest, NextResponse } from 'next/server';
import { run, findMany } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { isDemoMode, chatWithClaude } from '@/lib/demo-llm';

export const maxDuration = 60;

interface SuggestRequest {
  sessionId: string;
  format: string;
  commander?: string;
  commanderColorIdentity?: string[];
  archetype?: string;
  themes?: string[];
  tribalType?: string;
  psychographic?: string;
  budgetCents?: number;
  currentCards?: Record<string, number>;
  ownedCardNames?: string[];
  roleTargets?: Record<string, number>;
}

const PSYCHOGRAPHIC_INSTRUCTIONS: Record<string, string> = {
  spike: 'Prioritize the most competitive, efficient staples. Include optimal mana bases and proven meta choices.',
  johnny: 'Emphasize creative combo pieces and cards with non-obvious synergies. Include some jank that enables cool interactions.',
  timmy: 'Include powerful, flashy, high-impact cards. Big creatures, splashy spells, game-ending threats.',
  vorthos: 'Prioritize cards that fit the thematic or flavor identity of the deck, even if slightly suboptimal.',
  melvin: 'Emphasize elegant mechanical synergies. Cards that interact in clean, satisfying ways.',
};

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as SuggestRequest;
  const { sessionId, format, commander, commanderColorIdentity, archetype, themes = [], tribalType,
    psychographic, budgetCents, currentCards = {}, ownedCardNames = [], roleTargets } = body;

  const isCommander = ['commander','brawl','oathbreaker'].includes(format);
  const targets = roleTargets ?? {
    ramp: isCommander ? 10 : 4,
    card_draw: isCommander ? 10 : 6,
    removal: isCommander ? 10 : 8,   // 7 spot + 3 board wipes folded in
    win_conditions: isCommander ? 33 : 20, // threats + synergy pieces — the personality of the deck
    lands: isCommander ? 36 : 22,
  };

  const alreadyInDeck = Object.keys(currentCards);
  const budgetStr = budgetCents ? `$${(budgetCents / 100).toFixed(2)}` : 'no limit';

  // Fetch the admin-maintained rules doc (cached 5 min in the rules route)
  let rulesDoc = '';
  try {
    const rulesRes = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/deck-wizard/rules`,
      { headers: { cookie: req.headers.get('cookie') ?? '' } }
    );
    if (rulesRes.ok) {
      const rulesData = await rulesRes.json() as { value: string };
      rulesDoc = rulesData.value ?? '';
    }
  } catch { /* best effort */ }

  const prompt = `You are Khoa, a Magic: The Gathering deck building expert. Generate card suggestions for this deck.

REFERENCE RULES (use these ratios and guidelines when building the deck):
${rulesDoc ? rulesDoc.slice(0, 4000) : '(no rules doc available — use standard MTG deckbuilding conventions)'}
---

FORMAT: ${format}
${commander ? `COMMANDER: ${commander} (color identity: ${(commanderColorIdentity ?? []).join('')})` : ''}
ARCHETYPE: ${archetype ?? 'not specified'}
THEMES: ${themes.join(', ') || 'none'}
${tribalType ? `TRIBAL FOCUS: ${tribalType}` : ''}
BUDGET: ${budgetStr}
PSYCHOGRAPHIC: ${psychographic ?? 'not specified'}
${psychographic ? `STYLE INSTRUCTION: ${PSYCHOGRAPHIC_INSTRUCTIONS[psychographic] ?? ''}` : ''}

CARDS ALREADY IN DECK: ${alreadyInDeck.length > 0 ? alreadyInDeck.join(', ') : 'none yet'}
USER OWNS: ${ownedCardNames.length > 0 ? ownedCardNames.slice(0, 100).join(', ') : 'unknown'}

TARGET CARD COUNTS BY ROLE:
${Object.entries(targets).map(([role, count]) => `- ${role}: ${count} cards`).join('\n')}

Generate real Magic card suggestions organized by role. Suggest EXACTLY the target number of cards for each role (or as close as possible). A ${format} deck needs ${isCommander ? 100 : 60} cards total — fill every slot.

For each card include:
- The exact card name as printed (for Scryfall lookup)
- A one-sentence reason why it fits this deck
- Whether it's likely owned (check against USER OWNS list)
- Estimated price tier: budget (<$1), mid ($1-10), expensive ($10-30), premium (>$30)

RULES:
- Only suggest cards that exist in paper Magic: The Gathering — NO Arena-only cards (Alchemy "A-" prefix cards), NO MTGO-only cards
- Only suggest cards legal in ${format}
${isCommander && commanderColorIdentity?.length ? `- ALL cards must be within color identity: ${commanderColorIdentity.join('')} — no exceptions` : ''}
${isCommander ? '- Singleton: every card name must be unique (except basic lands)' : `- This is a ${format} constructed deck — you MUST run 3–4 copies of key spells and 2–4 copies of supporting cards. Running 1x of everything produces a weak, inconsistent deck. Use the suggestedQuantity field: staples and win conditions should be 4x, role-players 2–3x, situational cards 1–2x.`}
- Do NOT suggest cards already in the deck: ${alreadyInDeck.join(', ') || 'none'}
- Prioritize cards the user owns when possible
${budgetCents ? `- Stay within $${(budgetCents / 100).toFixed(2)} total; flag expensive cards with a cheaper alternative` : ''}
- For the Lands role: suggest ${targets.lands} individual non-basic utility lands (not just basics); fill-basics will add the basic lands separately

Return ONLY valid JSON matching this exact shape:
{
  "roles": [
    {
      "role": "Ramp",
      "target": 10,
      "cards": [
        {
          "name": "Sol Ring",
          "reason": "Staple ramp piece in Commander; produces 2 mana for 1.",
          "likelyOwned": true,
          "priceTier": "mid",
          "budgetAlternative": null,
          "suggestedQuantity": 1
        }
      ]
    }
  ],
  "summary": "Brief description of the deck strategy."
}

The suggestedQuantity field is CRITICAL for constructed formats. For commander/singleton formats always use 1. For Standard/Modern/Pioneer/Legacy/Pauper use these rules:
- Win conditions and staples: 4
- Role-players and synergy pieces: 3
- Situational or flex cards: 2
- Unique 1-ofs: 1
The total card count (sum of all suggestedQuantity values across all roles, plus basic lands) must equal exactly ${isCommander ? 100 : 60}.

Include these roles with their exact targets:
${Object.entries(targets).filter(([r]) => r !== 'lands').map(([role, n]) => `- ${role}: suggest exactly ${n} cards`).join('\n')}
- Lands: suggest exactly ${targets.lands} utility/non-basic lands (e.g. command tower, signets counted here if not in Ramp)

Hitting the target count per role is critical. A short deck is a broken deck.`;

  async function callGemini(model: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[suggest-cards] ${model} error`, res.status, errText.slice(0, 300));
        return null;
      }
      const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } };
      if (data.error) { console.error(`[suggest-cards] ${model} error:`, data.error.message); return null; }
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } catch (e) {
      clearTimeout(timeout);
      console.error(`[suggest-cards] ${model} threw:`, e);
      return null;
    }
  }

  try {
    const text = isDemoMode()
      ? await chatWithClaude(prompt, { maxTokens: 4096, temperature: 0.7 })
      : (await callGemini('gemini-2.5-flash')) ?? (await callGemini('gemini-3.1-flash-lite'));
    if (!text) {
      return NextResponse.json({ roles: [], summary: 'AI unavailable.' }, { status: 502 });
    }
    const parsed = JSON.parse(text) as { roles: Array<{ role: string; target: number; cards: Array<{ name: string; reason: string; likelyOwned: boolean; priceTier: string; budgetAlternative: string | null }> }>; summary: string };

    // Save suggestions to DB
    if (sessionId) {
      const existingSuggestions = await findMany<{ card_name: string }>(
        `SELECT card_name FROM deck_wizard_suggestions WHERE session_id = ?`, [sessionId]
      );
      const existing = new Set(existingSuggestions.map(s => s.card_name));

      let rank = 0;
      for (const roleGroup of parsed.roles ?? []) {
        for (const card of roleGroup.cards ?? []) {
          if (existing.has(card.name)) continue;
          await run(
            `INSERT INTO deck_wizard_suggestions (id, session_id, card_name, suggested_role, suggestion_rank, owned_by_user)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [randomUUID(), sessionId, card.name, roleGroup.role, rank++, card.likelyOwned]
          ).catch(() => {});
        }
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[suggest-cards] Unexpected error:', err);
    return NextResponse.json({ roles: [], summary: 'Failed to generate suggestions.' }, { status: 500 });
  }
}
