import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { nimChat, extractJson } from '@/lib/nvidia-nim';

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt } = await req.json() as { prompt: string };
  if (!prompt?.trim()) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

  const extractionPrompt = `You are a Magic: The Gathering deck building assistant. Extract structured deck building parameters from the user's description.

User input: "${prompt}"

Valid formats: standard, pioneer, modern, legacy, vintage, pauper, historic, timeless, commander, brawl, oathbreaker, draft, sealed, canadian_highlander, tiny_leaders, penny_dreadful

Valid archetypes: aggro, control, midrange, combo, tempo, prison, ramp

Valid themes: tokens, aristocrats, reanimator, mill, burn, voltron, counters, superfriends, spellslinger, landfall, enchantress, artifacts, graveyard, lifegain, politics, chaos, infect, blink, eldrazi

Valid psychographics: spike (winning efficiently), johnny (creative combos), timmy (big splashy spells), vorthos (flavor/story), melvin (elegant mechanics)

Return ONLY valid JSON:
{
  "format": "commander",
  "commanderName": null,
  "archetype": "midrange",
  "themes": ["superfriends", "counters"],
  "tribalType": null,
  "budgetCents": 15000,
  "psychographic": "timmy",
  "confidence": 0.92,
  "clarificationNeeded": []
}

Rules:
- format: pick the most likely format from the list. Default to "commander" if unclear.
- commanderName: only if user explicitly names a card. Do not guess.
- archetype: pick the closest match or null if unclear.
- themes: array of matching themes, empty array if none.
- tribalType: creature type if mentioned (e.g. "Vampires", "Elves"), null if not.
- budgetCents: convert dollar amounts to cents. null if no budget mentioned.
- psychographic: infer from language. "winning", "competitive" → spike. "combo", "cool" → johnny. "big", "powerful" → timmy. "flavor", "story" → vorthos. null if unclear.
- clarificationNeeded: array of field names that are ambiguous and need follow-up.
- confidence: overall confidence 0-1.`;

  try {
    const raw = await nimChat(extractionPrompt, 0.2);
    if (!raw) throw new Error('no response');
    const parsed = JSON.parse(extractJson(raw));
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({
      format: 'commander', commanderName: null, archetype: null, themes: [],
      tribalType: null, budgetCents: null, psychographic: null, confidence: 0,
      clarificationNeeded: ['format', 'archetype'],
    });
  }
}
