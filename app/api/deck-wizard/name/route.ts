import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { geminiChat, extractJson } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  if (!getAuthenticatedUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { commander, format, archetype, themes = [], tribalType, psychographic } = await req.json() as {
    commander?: string; format: string; archetype?: string; themes?: string[];
    tribalType?: string; psychographic?: string;
  };

  const STYLES = [
    'a clever pun on the commander\'s name or lore (e.g. "Proliferate or Die Trying", "The Atraxa Tax", "Krenko\'s Eleven")',
    'a pop culture reference twisted to fit the strategy (e.g. "Breaking Bad Permanents", "Game of Groans", "The Last Ramp Bender")',
    'a dramatic overstatement of the strategy (e.g. "The 99-Problem Solution", "This Is Fine (It Is Not Fine)")',
    'a villain\'s threat or monologue (e.g. "They Will Never See It Coming", "You Should Have Gone for the Head")',
    'flavor text energy — sounds like it belongs on an MTG card (e.g. "Where the Dead Remember", "The Mana Never Runs Out")',
    'a heist or action movie title (e.g. "Ocean\'s 99", "Fast & Furious Ninjutsu", "The Italian Job but Ninjas")',
    'a news headline from inside the game world (e.g. "Local Ninja Ruins Everyone\'s Day", "Commander Refuses to Stay Dead")',
  ];
  const chosenStyle = STYLES[Math.floor(Math.random() * STYLES.length)];
  // Random seed noun to break response caching and force a fresh creative direction each call
  const SEEDS = ['shadow','tide','storm','void','echo','blade','silence','ember','frost','ash','wire','smoke'];
  const seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];

  const prompt = `You are naming a Magic: The Gathering deck. Be creative, witty, and specific — avoid generic fantasy names.

COMMANDER: ${commander ?? 'none'}
FORMAT: ${format}
ARCHETYPE: ${archetype ?? 'not specified'}
THEMES: ${themes.join(', ') || 'none'}
TRIBAL FOCUS: ${tribalType ?? 'none'}
PLAYSTYLE: ${psychographic ?? 'not specified'}

YOUR STYLE FOR THIS NAME: ${chosenStyle}
(Creative seed word to inspire a fresh angle: "${seed}" — use it as inspiration, not literally)

Rules:
- 2–6 words
- Never use the word "deck"
- Never be generic ("Dragon Commander", "Zombie Tribal", "Token Strategy")
- Never repeat a style you've used before — commit to the style above
- Be clever, not cute

Return ONLY valid JSON:
{ "name": "The Clever Name Here" }`;

  try {
    const raw = await geminiChat(prompt, 1.0);
    if (!raw) return NextResponse.json({ name: null });
    const parsed = JSON.parse(extractJson(raw)) as { name?: string };
    return NextResponse.json({ name: parsed.name ?? null });
  } catch {
    return NextResponse.json({ name: null });
  }
}
