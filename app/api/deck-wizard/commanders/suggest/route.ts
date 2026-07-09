import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { geminiChat, extractJson } from '@/lib/gemini';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!getAuthenticatedUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { format, archetype, themes = [], tribalType, budgetCents } = await req.json() as {
    format: string; archetype?: string; themes?: string[]; tribalType?: string; budgetCents?: number;
  };

  const prompt = `You are a Magic: The Gathering expert. Suggest 5 commanders for the following deck concept.

FORMAT: ${format}
ARCHETYPE: ${archetype ?? 'not specified'}
THEMES: ${themes.join(', ') || 'not specified'}
TRIBAL FOCUS: ${tribalType ?? 'none'}
BUDGET: ${budgetCents ? `$${(budgetCents / 100).toFixed(0)}` : 'no limit'}

Return ONLY valid JSON — an array of exactly 5 commander suggestions:
{
  "commanders": [
    {
      "name": "Exact card name as printed",
      "reason": "One sentence on why this commander fits the concept",
      "colorIdentity": ["W","U"],
      "style": "Aggro | Control | Combo | Midrange | Voltron | Tokens | Stax"
    }
  ]
}

Rules:
- Only suggest cards legal as commanders in ${format}
- Vary the color identities and styles for breadth
- Order by how well they fit the stated themes`;

  try {
    const raw = await geminiChat(prompt, 0.8);
    if (!raw) return NextResponse.json({ commanders: [] });
    const parsed = JSON.parse(extractJson(raw)) as { commanders: Array<{ name: string; reason: string; colorIdentity: string[]; style: string }> };
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ commanders: [] });
  }
}
