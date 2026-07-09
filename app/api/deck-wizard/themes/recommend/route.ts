import { NextRequest, NextResponse } from 'next/server';
import { geminiChat, extractJson } from '@/lib/gemini';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const EMPTY = { themes: [], archetypes: [], tribal: [], psychographics: [] };

// Static archetype recommendations — instant, no LLM needed
const ARCHETYPE_RECS: Record<string, { themes: string[]; tribal: string[]; psychographics: string[]; whyThese: string }> = {
  aggro: {
    themes: ['burn', 'tokens'],
    tribal: [],
    psychographics: ['spike'],
    whyThese: 'Aggro decks win fast by swarming with cheap creatures and dealing direct damage. Tokens gives you board presence on turns 1–3, and Burn lets you close out the game when the opponent stabilizes. Spike players love aggro because the lines are clear and the clock is always ticking.',
  },
  control: {
    themes: ['spellslinger', 'graveyard'],
    tribal: [],
    psychographics: ['melvin'],
    whyThese: 'Control wins by saying no to everything, then winning with a single powerful threat. Spellslinger rewards casting answers, and Graveyard lets you recycle your best interaction. Melvin players love control because every card has a precise mechanical role.',
  },
  midrange: {
    themes: ['graveyard', 'tokens'],
    tribal: [],
    psychographics: ['spike'],
    whyThese: 'Midrange plays the most efficient card at every mana cost, grinding out value until the opponent runs out of answers. Graveyard interaction and token generation give you multiple axes of pressure. Spike players choose midrange because it beats whatever is popular.',
  },
  combo: {
    themes: ['artifacts', 'graveyard'],
    tribal: [],
    psychographics: ['johnny'],
    whyThese: 'Combo wins by assembling 2–3 specific pieces that end the game on the spot. Artifacts and Graveyard are the most common combo enablers across formats. Johnny players live for the turn everything clicks into place.',
  },
  tempo: {
    themes: ['spellslinger', 'blink'],
    tribal: [],
    psychographics: ['melvin'],
    whyThese: 'Tempo plays a threat and an answer on the same turn, staying permanently one step ahead. Spellslinger rewards your cheap interaction, and Blink lets you reuse ETB disruption. Melvin players love how elegantly tempo decks balance offense and defense.',
  },
  prison: {
    themes: ['artifacts', 'enchantress'],
    tribal: [],
    psychographics: ['melvin'],
    whyThese: 'Prison wins by locking the opponent out of the game through permanents that restrict their mana, cards, or spells. Artifacts and Enchantments are the primary lock-piece categories. Melvin players appreciate the ruthless mechanical precision of a good lock.',
  },
  ramp: {
    themes: ['eldrazi', 'landfall'],
    tribal: [],
    psychographics: ['timmy'],
    whyThese: 'Ramp spends the early turns generating far more mana than normal, then deploys enormous threats the opponent cannot answer. Eldrazi and Landfall give you payoffs for all that mana. Timmy players love casting something that makes the table say "wow."',
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const commander = searchParams.get('commander') ?? '';
  const archetype = searchParams.get('archetype') ?? '';
  const format = searchParams.get('format') ?? 'commander';

  if (!commander && !archetype) return NextResponse.json(EMPTY);

  // Archetype-based recs are static — instant, no LLM needed
  if (!commander && archetype) {
    const rec = ARCHETYPE_RECS[archetype.toLowerCase()];
    if (rec) return NextResponse.json({ ...rec, archetypes: [] });
    return NextResponse.json(EMPTY);
  }

  // Commander-based recommendations via LLM
  const prompt = `You are a Magic: The Gathering expert. For the commander "${commander}" in ${format} format, recommend which categories best fit this commander's abilities, color identity, and typical game plan.

If you are not certain about the exact card, make your best educated guess based on the name, any lore you know, and what would make sense given the colors and format. Do not return empty arrays — always recommend something reasonable.

Use ONLY the exact IDs listed. Return ONLY valid JSON.

STRATEGY THEMES — pick 2-4 that best fit this commander's game plan:
tokens, aristocrats, reanimator, mill, burn, voltron, counters, superfriends, spellslinger, landfall, enchantress, artifacts, graveyard, lifegain, politics, chaos, infect, blink, eldrazi

NAMED ARCHETYPES — pick 0-2 if a well-known Commander archetype fits:
jund, jeskai_control, sultai_midrange, dredge, storm, affinity, tron, death_taxes, bogles, hammertime, izzet_phoenix, living_end, food_chain, thashas_oracle, atraxa_superfriends, edgar_vampires, krenko_goblins

TRIBAL FOCUS — pick 0-2 only if this commander specifically lords over or cares about a creature type:
elves, zombies, vampires, humans, angels, goblins, dinosaurs, wizards, pirates, cats, merfolk, slivers, faeries, knights, dragons, werewolves, spirits, elementals, ninjas, squirrels, treefolk

PSYCHOGRAPHICS — pick exactly 1:
spike (competitive optimizer), johnny (creative combo builder), timmy (big splashy plays), vorthos (flavor and story), melvin (elegant mechanical synergy)

Also include:
- "whyThese": 2-3 sentences explaining why these themes fit this commander, referencing their specific abilities
- "winCondition": 1-2 sentences describing HOW this deck actually wins the game — the specific mechanism (e.g. "Win by connecting Ninjas with combat damage to trigger Yuriko's ability, draining opponents for the CMC of top-deck reveals while refilling your hand each attack.")

Return exactly:
{
  "themes": ["id1", "id2"],
  "archetypes": [],
  "tribal": [],
  "psychographics": ["johnny"],
  "whyThese": "Two or three sentences explaining why these themes fit this commander.",
  "winCondition": "One or two sentences describing the specific win mechanism."
}`;

  try {
    const raw = await geminiChat(prompt, 0.4);
    if (!raw) return NextResponse.json(EMPTY);
    const parsed = JSON.parse(extractJson(raw)) as { themes?: string[]; archetypes?: string[]; tribal?: string[]; psychographics?: string[]; whyThese?: string; winCondition?: string };
    return NextResponse.json({
      themes: parsed.themes ?? [],
      archetypes: parsed.archetypes ?? [],
      tribal: parsed.tribal ?? [],
      psychographics: parsed.psychographics ?? [],
      whyThese: parsed.whyThese ?? null,
      winCondition: parsed.winCondition ?? null,
    });
  } catch (e) {
    console.error('[themes/recommend] error:', e);
    return NextResponse.json(EMPTY);
  }
}
