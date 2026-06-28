import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { nimChat, extractJson } from '@/lib/nvidia-nim';

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cards } = await req.json() as { cards: string[] };
  if (!cards || cards.length < 10) return NextResponse.json({ combos: [], synergies: [] });

  const prompt = `You are a Magic: The Gathering expert. Analyze this card list and identify 2-3 card infinite combos and powerful synergies.

Card list:
${cards.join('\n')}

Return ONLY valid JSON:
{
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
    const raw = await nimChat(prompt, 0.3);
    if (!raw) return NextResponse.json({ combos: [], synergies: [] });
    return NextResponse.json(JSON.parse(extractJson(raw)));
  } catch {
    return NextResponse.json({ combos: [], synergies: [] });
  }
}
