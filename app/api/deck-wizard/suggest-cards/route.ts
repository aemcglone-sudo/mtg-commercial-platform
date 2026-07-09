import { NextRequest, NextResponse } from 'next/server';
import { run, findMany } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';
import { geminiChat, extractJson } from '@/lib/gemini';
import { randomUUID } from 'crypto';

export const maxDuration = 120;

// Cache color-identity and legality lookups for 30 min
const colorCache = new Map<string, string[]>();
const legalityCache = new Map<string, string[]>(); // format -> legal card names

// Cache of format → legal set names (refreshed every hour)
let standardSetsCache: { data: Record<string, string[]>; ts: number } | null = null;

async function getLegalSetsForFormat(format: string): Promise<string[]> {
  const FORMATS_WITH_ROTATION = ['standard', 'pioneer', 'historic', 'timeless', 'brawl'];
  const fmt = format.toLowerCase();
  if (!FORMATS_WITH_ROTATION.includes(fmt)) return [];

  if (standardSetsCache && Date.now() - standardSetsCache.ts < 60 * 60 * 1000) {
    return standardSetsCache.data[fmt] ?? [];
  }

  try {
    const res = await fetch('https://api.scryfall.com/sets', { headers: { 'User-Agent': 'Grimoire/1.0' } });
    if (!res.ok) return [];
    const json = await res.json() as { data: Array<{ name: string; code: string; set_type: string; released_at: string }> };

    const today = new Date().toISOString().slice(0, 10);
    // Standard rotates ~2 years back; pioneer ~8 years
    const cutoffs: Record<string, number> = { standard: 24, brawl: 24, historic: 84, timeless: 84, pioneer: 96 };
    const cutoffMonths = cutoffs[fmt] ?? 24;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - cutoffMonths);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const MAIN_SET_TYPES = new Set(['expansion', 'core', 'draft_innovation', 'masters']);
    const legalSets = json.data
      .filter(s => s.released_at <= today && s.released_at >= cutoffStr && MAIN_SET_TYPES.has(s.set_type))
      .sort((a, b) => b.released_at.localeCompare(a.released_at))
      .map(s => `${s.name} (${s.code.toUpperCase()}, released ${s.released_at})`);

    standardSetsCache = {
      data: { [fmt]: legalSets },
      ts: Date.now(),
    };
    return legalSets;
  } catch {
    return [];
  }
}

async function filterByFormatLegality(cardNames: string[], format: string): Promise<string[]> {
  if (!format || format === 'custom') return cardNames;

  // Map our format names to Scryfall legality keys
  const FORMAT_MAP: Record<string, string> = {
    standard: 'standard', pioneer: 'pioneer', modern: 'modern',
    legacy: 'legacy', vintage: 'vintage', pauper: 'pauper',
    historic: 'historic', timeless: 'timeless',
    commander: 'commander', brawl: 'brawl', oathbreaker: 'oathbreaker',
  };
  const scryfallFormat = FORMAT_MAP[format.toLowerCase()];
  if (!scryfallFormat) return cardNames;

  const CHUNK = 75;
  const legalNames: string[] = [];

  for (let i = 0; i < cardNames.length; i += CHUNK) {
    const chunk = cardNames.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
      });
      if (!res.ok) { legalNames.push(...chunk); continue; }
      const data = await res.json() as { data: Array<{ name: string; legalities: Record<string, string> }> };
      for (const card of data.data) {
        const legality = card.legalities[scryfallFormat];
        if (legality === 'legal') {
          legalNames.push(card.name);
        } else {
          console.log(`[suggest-cards] filtered ${card.name}: ${scryfallFormat}=${legality}`);
        }
      }
    } catch {
      legalNames.push(...chunk);
    }
    if (i + CHUNK < cardNames.length) await new Promise(r => setTimeout(r, 110));
  }

  return legalNames;
}

async function filterByColorIdentity(cardNames: string[], commanderColors: string[]): Promise<string[]> {
  if (!commanderColors.length) return cardNames; // colorless commander — all cards legal

  const legalColors = new Set(commanderColors.map(c => c.toUpperCase()));

  // Check cache
  const cacheKey = [...cardNames].sort().join('|') + ':' + commanderColors.sort().join('');
  if (colorCache.has(cacheKey)) return colorCache.get(cacheKey)!;

  // Fetch color identities from Scryfall in chunks of 75
  const CHUNK = 75;
  const legalNames: string[] = [];

  for (let i = 0; i < cardNames.length; i += CHUNK) {
    const chunk = cardNames.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
      });
      if (!res.ok) {
        // On Scryfall error, allow all cards in this chunk through
        legalNames.push(...chunk);
        continue;
      }
      const data = await res.json() as { data: Array<{ name: string; color_identity: string[] }> };
      for (const card of data.data) {
        const cardColors = card.color_identity.map(c => c.toUpperCase());
        // Card is legal if all its colors are in the commander's color identity
        const isLegal = cardColors.every(c => legalColors.has(c));
        if (isLegal) legalNames.push(card.name);
      }
    } catch {
      // On network error, allow chunk through
      legalNames.push(...chunk);
    }
    if (i + CHUNK < cardNames.length) await new Promise(r => setTimeout(r, 110));
  }

  colorCache.set(cacheKey, legalNames);
  // Evict cache if it grows too large
  if (colorCache.size > 50) colorCache.delete(colorCache.keys().next().value!);

  return legalNames;
}

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
  deckColors?: string[]; // non-commander: user-selected color palette
  collectionOnly?: boolean;
  rubricFeedback?: string; // injected from a failed rubric score on a previous attempt
}

interface CommanderData {
  oracleText: string;
  typeLine: string;
  detectedTribal: string | null; // e.g. "Ninja" from "Legendary Creature — Human Ninja"
}

async function fetchTribalCards(tribalType: string, colorIdentity: string[]): Promise<string[]> {
  try {
    // Build color identity query: "color<=UB" means cards with color identity subset of UB
    const colorStr = colorIdentity.map(c => c.toUpperCase()).join('').toLowerCase();
    const colorQuery = colorStr ? `+color<=${colorStr}` : '';
    const query = `t:${tribalType.toLowerCase()}+is:commander-legal${colorQuery}`;
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=edhrec&page=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Grimoire/1.0' } });
    if (!res.ok) return [];
    const json = await res.json() as { data: Array<{ name: string }> };
    return json.data.slice(0, 40).map(c => c.name);
  } catch {
    return [];
  }
}

async function fetchCommanderData(commanderName: string): Promise<CommanderData | null> {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(commanderName)}`,
      { headers: { 'User-Agent': 'Grimoire/1.0' } }
    );
    if (!res.ok) return null;
    const card = await res.json() as { oracle_text?: string; type_line?: string };
    const typeLine = card.type_line ?? '';
    // Extract creature type after the em-dash, e.g. "Legendary Creature — Human Ninja" → "Ninja"
    const typeMatch = typeLine.match(/—\s*(.+)/);
    const subtypes = typeMatch ? typeMatch[1].trim().split(/\s+/) : [];
    // Common tribal-relevant creature types
    const TRIBAL_TYPES = new Set([
      'Ninja','Pirate','Zombie','Vampire','Dragon','Wizard','Elf','Goblin',
      'Merfolk','Angel','Demon','Spirit','Human','Knight','Warrior','Shaman',
      'Cat','Bird','Beast','Elemental','Dinosaur','Faerie','Giant','Sliver',
      'Soldier','Cleric','Rogue','Druid','Artificer','Shapeshifter','Horror',
    ]);
    const detectedTribal = subtypes.find(t => TRIBAL_TYPES.has(t)) ?? null;
    return { oracleText: card.oracle_text ?? '', typeLine, detectedTribal };
  } catch {
    return null;
  }
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
    psychographic, budgetCents, currentCards = {}, ownedCardNames = [], roleTargets, deckColors = [], collectionOnly = false,
    rubricFeedback } = body;

  const isCommander = ['commander','brawl','oathbreaker'].includes(format);
  // Non-commander targets vary by archetype — aggro needs creatures, control needs interaction.
  const nonCommanderTargets = (() => {
    switch (archetype?.toLowerCase()) {
      case 'aggro': return { creatures: 24, removal: 8, card_draw: 4, lands: 24 };
      case 'control': return { creatures: 6, removal: 10, card_draw: 10, win_conditions: 8, lands: 26 };
      case 'midrange': return { creatures: 14, removal: 8, card_draw: 6, win_conditions: 6, lands: 26 };
      case 'combo': return { creatures: 8, combo_pieces: 12, card_draw: 8, removal: 4, lands: 22 };
      default: return { creatures: 14, removal: 8, card_draw: 6, win_conditions: 6, lands: 22 };
    }
  })();

  const targets = roleTargets ?? (isCommander ? {
    ramp: 10,           // mana rocks, land ramp, dorks
    card_draw: 10,      // draw spells, engines, cantrips
    removal: 8,         // spot removal only (creatures, artifacts, enchantments, planeswalkers)
    board_wipes: 4,     // mass removal — Wrath of God, Blasphemous Act, Cyclonic Rift etc.
    win_conditions: 31, // synergy/core strategy cards, threats, engines
    lands: 36,          // utility lands only — basics added separately by fill-basics
  } : nonCommanderTargets);

  const alreadyInDeck = Object.keys(currentCards);
  const budgetStr = budgetCents ? `$${(budgetCents / 100).toFixed(2)}` : 'no limit';

  // Fetch structured deck rules, legal sets, and commander data in parallel
  let rulesDoc = '';
  let legalSetsDoc = '';
  // eslint-disable-next-line prefer-const
  let commanderData: CommanderData | null = null as CommanderData | null;
  await Promise.all([
    fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/deck-wizard/rules-structured`,
      { headers: { cookie: req.headers.get('cookie') ?? '' } }
    ).then(r => r.ok ? r.json() as Promise<{ rules: string }> : { rules: '' })
      .then(d => { rulesDoc = d.rules ?? ''; })
      .catch(() => {}),
    getLegalSetsForFormat(format).then(sets => {
      if (sets.length) {
        legalSetsDoc = `SETS CURRENTLY LEGAL IN ${format.toUpperCase()} (as of today — only suggest cards from these sets):\n${sets.join('\n')}`;
      }
    }),
    isCommander && commander
      ? fetchCommanderData(commander).then(d => { commanderData = d; })
      : Promise.resolve(),
  ]);

  // Auto-detect tribal type if not provided by user
  const effectiveTribal = tribalType ?? commanderData?.detectedTribal ?? null;

  // Fetch actual tribal cards from Scryfall so Khoa has real card names to work with
  // eslint-disable-next-line prefer-const
  let tribalCardList: string[] = [];
  if (isCommander && effectiveTribal && commanderColorIdentity?.length) {
    tribalCardList = await fetchTribalCards(effectiveTribal, commanderColorIdentity);
    console.log(`[suggest-cards] fetched ${tribalCardList.length} ${effectiveTribal} cards for grounding`);
  }


  type CardSuggestion = { name: string; reason: string; likelyOwned: boolean; priceTier: string; budgetAlternative: string | null; suggestedQuantity?: number };
  type RoleGroup = { role: string; target: number; cards: CardSuggestion[] };
  type Parsed = { roles: RoleGroup[]; summary: string };

  function parseResponse(text: string): Parsed | null {
    const jsonStr = extractJson(text);
    try { return JSON.parse(jsonStr) as Parsed; } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : String(e);
      console.error(`[suggest-cards] JSON parse error: ${msg}`);
      console.error(`[suggest-cards] Response tail (last 500): ${text.slice(-500)}`);
      return null;
    }
  }

  try {
    let parsed: Parsed;

    if (collectionOnly && ownedCardNames.length > 0) {
      // Pre-filter: format legality first, then color identity
      let legalNames = !isCommander
        ? await filterByFormatLegality(ownedCardNames, format)
        : ownedCardNames;

      if (commanderColorIdentity?.length) {
        legalNames = await filterByColorIdentity(legalNames, commanderColorIdentity);
      }

      if (!isCommander && deckColors.length) {
        legalNames = await filterByColorIdentity(legalNames, deckColors);
      }

      console.log(`[suggest-cards] collection-only: ${ownedCardNames.length} owned → ${legalNames.length} legal for format+color`);

      const ownedSet = new Set(legalNames.map(n => n.toLowerCase()));
      const roleList = Object.entries(targets);
      const roleGroups: RoleGroup[] = [];
      const ownedList = legalNames.slice(0, 800).join(', ');

      const buildRolePrompt = (role: string, count: number, exclude: string[]) =>
        `You are a Magic: The Gathering deck building expert.
${rubricFeedback ? `\n⚠️ RUBRIC FAILURES FROM PREVIOUS ATTEMPT — YOU MUST FIX THESE:\n${rubricFeedback}\n` : ''}
DECK BUILDING RULES:
${rulesDoc ? rulesDoc.slice(0, 1000) : '(use standard Commander deckbuilding conventions)'}

COMMANDER: ${commander ?? 'none'} | FORMAT: ${format}
${commanderData?.typeLine ? `COMMANDER TYPE: ${commanderData.typeLine}` : ''}
${commanderData?.oracleText ? `COMMANDER ABILITY: ${commanderData.oracleText}` : ''}
THEMES: ${themes.join(', ') || 'none'}
${effectiveTribal ? `TRIBAL: ${effectiveTribal} — prioritize ${effectiveTribal} creatures when filling creature slots` : ''}
${effectiveTribal && tribalCardList.length > 0 && role === 'win_conditions' ? `KNOWN ${effectiveTribal.toUpperCase()} CARDS: ${tribalCardList.join(', ')}` : ''}
ROLE TO FILL: ${role} — need exactly ${count} cards
DO NOT suggest: ${[...alreadyInDeck, ...exclude].join(', ') || 'none'}

OWNED CARDS (pick ONLY from this list, verbatim names):
${ownedList}

Return ONLY valid JSON — no prose:
{"cards":[{"name":"exact name from list","reason":"max 8 words","likelyOwned":true,"priceTier":"budget","budgetAlternative":null,"suggestedQuantity":1}]}`;

      const allUsed = new Set<string>();

      for (const [role, count] of roleList) {
        let filtered: CardSuggestion[] = [];
        const exclude = [...allUsed];

        // Up to 2 attempts per role to hit the target count after color filtering
        for (let attempt = 0; attempt < 2; attempt++) {
          const needed = count - filtered.length;
          if (needed <= 0) break;
          const text = await geminiChat(buildRolePrompt(role, needed, [...exclude, ...filtered.map(c => c.name)]), 0.7, undefined, 1500);
          if (!text) break;
          const data = parseResponse(text) as { cards?: CardSuggestion[] } | null;
          const batch: CardSuggestion[] = (data as { cards?: CardSuggestion[] })?.cards ?? [];
          const valid = batch.filter(c =>
            ownedSet.has(c.name.toLowerCase()) &&
            !allUsed.has(c.name.toLowerCase()) &&
            !filtered.some(f => f.name.toLowerCase() === c.name.toLowerCase())
          );
          filtered.push(...valid);
        }

        filtered.forEach(c => allUsed.add(c.name.toLowerCase()));
        roleGroups.push({ role, target: count, cards: filtered });
      }

      parsed = { roles: roleGroups, summary: 'Deck built from your collection.' };
    } else {
      // Per-role fetching for all modes — avoids 8192-token truncation on full-deck prompts.
      console.log(`[suggest-cards] regular mode — format:${format} commander:${commander ?? 'none'}`);

      const buildRolePrompt = (role: string, count: number, exclude: string[]) => {
        const colorRule = isCommander && commanderColorIdentity?.length
          ? `COLOR IDENTITY: ${commanderColorIdentity.join('')} — every card must be within this identity. No exceptions. A card's color identity includes all mana symbols in its cost AND rules text.`
          : !isCommander && deckColors.length
          ? `DECK COLORS: ${deckColors.join('')} — suggest ONLY cards whose casting cost uses these colors (${deckColors.map(c => ({ W:'White',U:'Blue',B:'Black',R:'Red',G:'Green' })[c] ?? c).join('/')}). No cards requiring colors outside this palette.`
          : '';
        const quantityRule = isCommander
          ? 'suggestedQuantity: always 1 (singleton — only one copy of each card except basic lands)'
          : 'suggestedQuantity: staples/win-cons 4x, role-players 3x, situational 2x, unique 1x';

        // For Commander, win_conditions covers the entire synergy/strategy core (31 cards) including creatures.
        const commanderWinConGuidance = (() => {
          const oracleText = commanderData?.oracleText ?? '';
          const tribal = effectiveTribal;
          const typeLine = commanderData?.typeLine ?? '';

          let guidance = `The synergy core and win conditions for this Commander deck. This is the largest role (${count} cards) and covers EVERYTHING that makes the deck work — creatures, spells, enchantments, artifacts, and planeswalkers. This role IS the deck's identity.\n\n`;

          if (commander) {
            guidance += `COMMANDER: ${commander}\n`;
            if (typeLine) guidance += `TYPE LINE: ${typeLine}\n`;
            if (oracleText) guidance += `ORACLE TEXT: ${oracleText}\n\n`;
            guidance += `CRITICAL: Read the commander's oracle text above and build accordingly. If the commander mentions a specific creature type (e.g. Ninja, Pirate, Zombie), a majority of the creature slots MUST be that creature type. If the commander has a triggered ability that requires specific game actions (ninjutsu, combat damage triggers, sacrifice outlets), include the enablers that make those triggers happen.\n\n`;
          }

          if (tribal) {
            guidance += `TRIBAL REQUIREMENT: This deck runs ${tribal} tribal. AT LEAST 15 of the ${count} cards must be ${tribal} creatures or cards that specifically care about ${tribal}s. Include a mix of: low-cost ${tribal}s that can attack early, powerful ${tribal}s that are the main threats, ${tribal} lords/anthems, and cards that synergize with the tribe. Do not fill this role with generic good-stuff spells.\n\n`;
            if (tribalCardList.length > 0) {
              guidance += `REAL ${tribal.toUpperCase()} CARDS FROM SCRYFALL (these are verified, commander-legal ${tribal} cards in this color identity — pick at least 15 from this list):\n${tribalCardList.join(', ')}\n\n`;
            }
          }

          guidance += `Fill out the remaining slots with: combo pieces, payoff enchantments/artifacts, tutor effects, finisher spells, and cards that support the commander's strategy. Aim for a cohesive deck, not a collection of individually powerful cards.`;

          return guidance;
        })();

        const roleGuidance: Record<string, string> = {
          ramp: `Mana acceleration only. Includes: mana rocks (Sol Ring, Arcane Signet, signets, talismans), land-fetching sorceries (Cultivate, Kodama's Reach, Rampant Growth), mana dorks (Birds of Paradise, Llanowar Elves), and land-cycling cards. Match the archetype — artifact-heavy decks prefer rocks, green decks prefer land ramp.`,
          card_draw: `Card advantage engines and draw spells only. Includes: cantrips, draw spells (Night's Whisper, Brainstorm), enchantment engines (Rhystic Study, Sylvan Library), creature-based draw (Beast Whisperer, Phyrexian Arena), loot effects. Prioritize repeatable draw over one-shots.`,
          removal: `SPOT removal only — single-target interaction. Includes: creature removal (Swords to Plowshares, Path to Exile, Beast Within), artifact/enchantment removal (Disenchant, Naturalize), counterspells (in blue), planeswalker removal. Do NOT include board wipes here — those go in the board_wipes role.`,
          board_wipes: `MASS removal only — cards that clear the whole battlefield or large portions of it. Examples: Wrath of God, Day of Judgment, Blasphemous Act, Cyclonic Rift, Damnation, Farewell, Toxic Deluge, Supreme Verdict, Vanquish the Horde. Aim for 3–4 of varying mana costs so you have emergency resets at different points in the game.`,
          creatures: `CREATURES ONLY — no instants, sorceries, enchantments, or artifacts unless they are creature cards. For aggro: low-curve threats (1–3 CMC), hasty creatures, evasive attackers, lords/pumpers. For midrange: value creatures with ETB effects, resilient threats. For tribal: creatures of the chosen tribe plus synergistic support creatures. This slot IS the deck's threat base — every pick should be a creature that attacks, blocks, or generates immediate board presence.`,
          combo_pieces: `Combo enablers, payoff cards, and the engine pieces that make the deck win. Includes tutors to find combo pieces, protection for the combo, and redundant copies of key effects. Prioritize consistency and speed.`,
          win_conditions: isCommander ? commanderWinConGuidance : `Non-creature spells and artifacts that close out the game or generate overwhelming value. Includes planeswalkers, powerful enchantments, finisher spells, and engines. The deck's threats should already be covered by the creatures role — this is for the non-creature payoffs.`,
          lands: `UTILITY AND NON-BASIC LANDS ONLY. Absolutely no basic lands (Plains, Island, Swamp, Mountain, Forest) — those are added automatically later.
Include a strong mix of:
- Color-fixing duals/fetches appropriate to the color identity (shock lands, check lands, pain lands, filter lands, slow lands)
- Utility lands that synergize with the archetype or provide value (Reliquary Tower, Emergence Zone, Alchemist's Refuge, etc.)
- Command Tower (always include for Commander)
- Exotic Orchard, Mana Confluence, City of Brass for multicolor fixing
- Cycle lands (Irrigated Farmland etc.) for late-game cycling
The goal is a functional, consistent mana base with relevant utility. Make it archetype-aware.`,
        };

        const guidance = roleGuidance[role.toLowerCase()] ?? `Cards that fulfill the ${role} role in this deck.`;

        return `You are Khoa, a Magic: The Gathering deck building expert filling one specific role in a deck.
${rubricFeedback ? `\n⚠️ RUBRIC FAILURES FROM PREVIOUS ATTEMPT — YOU MUST FIX THESE:\n${rubricFeedback}\n` : ''}
DECK CONTEXT:
- Format: ${format}
${commander ? `- Commander: ${commander}` : ''}
- Archetype: ${archetype ?? 'not specified'}
- Themes: ${themes.join(', ') || 'none'}
${effectiveTribal ? `- Tribal: ${effectiveTribal}` : ''}
- Budget: ${budgetStr}
${psychographic ? `- Style: ${PSYCHOGRAPHIC_INSTRUCTIONS[psychographic] ?? psychographic}` : ''}
${rulesDoc ? `\nDECK RULES:\n${rulesDoc.slice(0, 1500)}` : ''}
${legalSetsDoc ? `\n${legalSetsDoc}` : ''}

ROLE: ${role} — suggest exactly ${count} cards
ROLE GUIDANCE: ${guidance}

${colorRule}

ALREADY IN DECK (do not repeat): ${[...alreadyInDeck, ...exclude].join(', ') || 'none'}
USER OWNS (prioritize if a good fit): ${ownedCardNames.slice(0, 100).join(', ') || 'unknown'}

Requirements:
- Only real paper Magic cards (no Arena-only Alchemy cards, no MTGO-only cards)
- Legal in ${format} — ONLY suggest cards from the legal sets listed above
${isCommander ? '- Singleton format: every card name must be unique' : ''}
- ${quantityRule}
- reason field: max 8 words explaining why it fits THIS specific deck

Return ONLY valid JSON, no explanation:
{"cards":[{"name":"Exact Card Name","reason":"fits theme","likelyOwned":false,"priceTier":"budget","budgetAlternative":null,"suggestedQuantity":1}]}`;
      };

      const roleList = Object.entries(targets);
      const roleGroups: RoleGroup[] = [];
      const allUsed = new Set<string>(alreadyInDeck.map(n => n.toLowerCase()));

      for (const [role, count] of roleList) {
        const exclude = [...allUsed];
        const maxTok = Math.min(6000, Math.max(1500, count * 130));
        const text = await geminiChat(buildRolePrompt(role, count, exclude), 0.7, undefined, maxTok);
        if (!text) {
          console.error(`[suggest-cards] AI null for role ${role}`);
          roleGroups.push({ role, target: count, cards: [] });
          continue;
        }
        const data = parseResponse(text) as { cards?: CardSuggestion[] } | null;
        let cards: CardSuggestion[] = (data as { cards?: CardSuggestion[] })?.cards ?? [];

        // Enforce deck color constraint for non-commander formats
        if (!isCommander && deckColors.length) {
          const names = cards.map(c => c.name);
          const colorLegal = new Set(await filterByColorIdentity(names, deckColors));
          const before = cards.length;
          cards = cards.filter(c => colorLegal.has(c.name));
          if (cards.length < before) {
            console.warn(`[suggest-cards] deck-color filter removed ${before - cards.length} off-color cards from ${role}`);
          }
        }

        // Enforce format legality via Scryfall — Claude suggests cards from wrong sets/eras
        if (!isCommander) {
          const names = cards.map(c => c.name);
          const legalNames = new Set(await filterByFormatLegality(names, format));
          const before = cards.length;
          cards = cards.filter(c => legalNames.has(c.name));
          if (cards.length < before) {
            console.warn(`[suggest-cards] legality filter removed ${before - cards.length} non-${format} cards from ${role}`);
          }
        }

        // Enforce color identity via Scryfall — Claude will occasionally suggest off-color cards
        if (isCommander && commanderColorIdentity?.length) {
          const names = cards.map(c => c.name);
          const legalNames = new Set(await filterByColorIdentity(names, commanderColorIdentity));
          const before = cards.length;
          cards = cards.filter(c => legalNames.has(c.name));
          if (cards.length < before) {
            console.warn(`[suggest-cards] color filter removed ${before - cards.length} off-color cards from ${role}`);
          }
        }

        cards.forEach(c => allUsed.add(c.name.toLowerCase()));
        roleGroups.push({ role, target: count, cards });
        console.log(`[suggest-cards] role ${role}: ${cards.length}/${count} cards`);
      }

      const totalCards = roleGroups.reduce((s, r) => s + r.cards.length, 0);
      console.log(`[suggest-cards] Done — ${totalCards} total cards across ${roleGroups.length} roles`);
      parsed = { roles: roleGroups, summary: `${format} deck built around ${commander ?? archetype ?? 'your chosen strategy'}.` };
    }

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
