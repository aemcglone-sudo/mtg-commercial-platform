import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { nimChat, extractJson } from '@/lib/nvidia-nim';

export async function POST(req: NextRequest) {
  if (!getAuthenticatedUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { commander, format, archetype, themes = [], tribalType, psychographic } = await req.json() as {
    commander?: string; format: string; archetype?: string; themes?: string[];
    tribalType?: string; psychographic?: string;
  };

  const prompt = `You are naming a Magic: The Gathering deck. Be creative, witty, and specific — avoid generic fantasy names.

COMMANDER: ${commander ?? 'none'}
FORMAT: ${format}
ARCHETYPE: ${archetype ?? 'not specified'}
THEMES: ${themes.join(', ') || 'none'}
TRIBAL FOCUS: ${tribalType ?? 'none'}
PLAYSTYLE: ${psychographic ?? 'not specified'}

Great deck names do ONE of these things:
1. A clever pun on the commander's name or lore ("Proliferate or Die Trying", "The Atraxa Tax", "Krenko's Eleven")
2. A pop culture reference twisted to fit the strategy ("Breaking Bad (Permanents)", "Game of Groans", "The Last Ramp Bender")
3. A dramatic overstatement of the strategy ("The 99-Problem Solution", "This Is Fine (It Is Not Fine)", "The Board Wipe Heard Round the World")
4. A villain speech / threat ("They Will Never See It Coming", "I've Been Planning This Since Turn One", "You Should Have Gone for the Head")
5. Flavor text energy — sounds like it belongs on a card ("Where the Dead Remember", "One Creature, Infinite Turns", "The Mana Never Runs Out")

Rules:
- 2–6 words
- Never use the word "deck"
- Never be generic ("Dragon Commander", "Zombie Tribal", "Token Strategy")
- Be clever, not cute

Return ONLY valid JSON:
{ "name": "The Clever Name Here" }`;

  try {
    const raw = await nimChat(prompt, 1.0);
    if (!raw) return NextResponse.json({ name: null });
    const parsed = JSON.parse(extractJson(raw)) as { name?: string };
    return NextResponse.json({ name: parsed.name ?? null });
  } catch {
    return NextResponse.json({ name: null });
  }
}
