import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { geminiChat, extractJson } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cards, commander, format } = await req.json() as { cards: string[]; commander?: string; format?: string };
  if (!cards || cards.length < 10) return NextResponse.json({ combos: [], synergies: [], winCondition: null });

  const prompt = `You are a Magic: The Gathering expert. Analyze this card list and identify how the deck wins, any infinite combos, and powerful synergies.
${commander ? `Commander: ${commander}` : ''}
${format ? `Format: ${format}` : ''}

Card list:
${cards.join('\n')}

Return ONLY valid JSON:
{
  "winCondition": "1-2 sentences describing the PRIMARY way this deck wins — be specific about the mechanism, not vague (e.g. 'Win by triggering Yuriko repeatedly with Ninja combat damage, draining each opponent for high-CMC reveals while refilling your hand' not 'win through synergies').",
  "combos": [
    {
      "cards": ["Card Name 1", "Card Name 2"],
      "description": "How the combo works in 1-2 sentences.",
      "difficulty": "easy",
      "type": "infinite"
    }
  ],
  "synergies": [
    {
      "cards": ["Card Name 1", "Card Name 2"],
      "description": "How these cards synergize."
    }
  ]
}

Only include combos where ALL pieces are in the provided card list.
Combos: focus on infinite combos and game-winning 2-3 card interactions.
Synergies: focus on powerful but non-infinite synergies worth highlighting.
difficulty: "easy" (straightforward) or "complex" (requires setup or multiple steps).
type: "infinite" or "powerful".
Limit to 5 combos and 5 synergies maximum.`;

  try {
    const raw = await geminiChat(prompt, 0.3);
    if (!raw) return NextResponse.json({ combos: [], synergies: [], winCondition: null });
    const parsed = JSON.parse(extractJson(raw)) as { winCondition?: string; combos?: unknown[]; synergies?: unknown[] };
    return NextResponse.json({
      winCondition: parsed.winCondition ?? null,
      combos: parsed.combos ?? [],
      synergies: parsed.synergies ?? [],
    });
  } catch {
    return NextResponse.json({ combos: [], synergies: [], winCondition: null });
  }
}
