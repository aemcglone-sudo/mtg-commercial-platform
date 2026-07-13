import { NextRequest } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany } from '@/lib/db';
import { extractJson } from '@/lib/gemini';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { name: string; content: unknown } } };

type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

async function geminiWithTools(
  systemInstruction: string,
  contents: GeminiContent[],
  tools: GeminiFunctionDeclaration[],
): Promise<{ parts: GeminiPart[]; finishReason: string } | null> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const body = JSON.stringify({
    systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
    contents,
    tools: [{ functionDeclarations: tools }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
  });
  const delays = [3000, 8000, 20000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.status === 429 && attempt < delays.length) {
        const wait = delays[attempt];
        console.warn(`[gemini-tools] 429 rate limit — waiting ${wait}ms before retry ${attempt + 1}`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error('[gemini-tools] HTTP', res.status, err.slice(0, 500));
        return { parts: [{ text: `[gemini-error] HTTP ${res.status}: ${err.slice(0, 300)}` }], finishReason: 'error' };
      }
      const data = await res.json() as {
        candidates?: Array<{
          content: { parts: GeminiPart[] };
          finishReason: string;
        }>;
      };
      const candidate = data.candidates?.[0];
      if (!candidate) return null;
      return { parts: candidate.content.parts, finishReason: candidate.finishReason };
    } catch (e) {
      console.error('[gemini-tools] threw:', e);
      if (attempt < delays.length) {
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
      return null;
    }
  }
  return null;
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const BASIC_LANDS = new Set([
  'Plains','Island','Swamp','Mountain','Forest','Wastes',
  'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp',
  'Snow-Covered Mountain','Snow-Covered Forest',
]);

const RAMP_WORDS = ['add','mana','land','search your library for a','basic land'];
const DRAW_WORDS = ['draw a card','draw two','draw three','draw cards','draw x'];
const REMOVAL_WORDS = ['destroy target','exile target','counter target','return target','deals','damage to'];

function classifyCard(oracleText: string, typeLine: string): string {
  const t = oracleText.toLowerCase();
  const ty = typeLine.toLowerCase();
  if (ty.includes('land')) return 'land';
  if (RAMP_WORDS.some(w => t.includes(w)) && !ty.includes('creature')) return 'ramp';
  if (DRAW_WORDS.some(w => t.includes(w))) return 'draw';
  if (REMOVAL_WORDS.some(w => t.includes(w))) return 'removal';
  if (ty.includes('creature')) return 'creature';
  return 'other';
}

function analyzeDeck(cards: Record<string, number>, colorIdentity: string[]) {
  const counts = { total: 0, land: 0, ramp: 0, draw: 0, removal: 0, creature: 0, other: 0 };
  for (const [, qty] of Object.entries(cards)) counts.total += qty;
  return counts;
}

// --- Scryfall tool implementations ---

async function scryfallSearch(q: string, limit = 30): Promise<Array<{ name: string; mana_cost: string; type_line: string; oracle_text: string; cmc: number; color_identity: string[]; prices?: { usd?: string } }>> {
  try {
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=edhrec&unique=cards`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Grimoire/1.0' } });
    if (!res.ok) return [];
    const data = await res.json() as { data: Array<{ name: string; mana_cost: string; type_line: string; oracle_text: string; cmc: number; color_identity: string[]; prices?: { usd?: string } }> };
    return (data.data ?? []).slice(0, limit);
  } catch { return []; }
}

type CardDetail = { name: string; mana_cost: string; type_line: string; oracle_text: string; cmc: number; color_identity: string[]; prices?: { usd?: string } };

async function fetchOwnedCardPool(cardNames: string[], colorIdentity: string[]): Promise<CardDetail[]> {
  const CHUNK = 75;
  const all: CardDetail[] = [];
  const legalColors = colorIdentity.length > 0 ? new Set(colorIdentity.map(c => c.toUpperCase())) : null;

  for (let i = 0; i < cardNames.length; i += CHUNK) {
    const chunk = cardNames.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
      });
      if (!res.ok) continue;
      const data = await res.json() as { data: CardDetail[] };
      for (const card of data.data) {
        if (BASIC_LANDS.has(card.name)) continue;
        if (legalColors && !card.color_identity.every(c => legalColors.has(c.toUpperCase()))) continue;
        all.push(card);
      }
    } catch { /* skip chunk */ }
    if (i + CHUNK < cardNames.length) await new Promise(r => setTimeout(r, 80));
  }
  return all;
}

function searchOwnedPool(pool: CardDetail[], query: string, limit: number): CardDetail[] {
  const q = query.toLowerCase();

  // Handle OR queries by splitting and unioning results
  if (/ or /i.test(query)) {
    const parts = query.split(/ or /i);
    const seen = new Set<string>();
    const results: CardDetail[] = [];
    for (const part of parts) {
      for (const card of searchOwnedPool(pool, part.trim(), limit)) {
        if (!seen.has(card.name)) { seen.add(card.name); results.push(card); }
      }
    }
    return results.slice(0, limit);
  }

  const oTerms: string[] = [];
  const oNeg: string[] = [];
  const tTerms: string[] = [];
  const nameTerms: string[] = [];
  let cmcMax: number | null = null;
  let cmcMin: number | null = null;

  // o:"..." quoted
  for (const m of query.matchAll(/\bo:"([^"]+)"/g)) oTerms.push(m[1].toLowerCase());
  // -o:"..." negated
  for (const m of query.matchAll(/-o:"([^"]+)"/g)) oNeg.push(m[1].toLowerCase());
  // o:word unquoted
  for (const m of query.matchAll(/(?<!-)o:([^"\s]+)/g)) oTerms.push(m[1].toLowerCase());
  // t:word
  for (const m of query.matchAll(/\bt:([^"\s]+)/g)) tTerms.push(m[1].toLowerCase());
  // name:"..." or name:word
  for (const m of query.matchAll(/\bname:"([^"]+)"/g)) nameTerms.push(m[1].toLowerCase());
  for (const m of query.matchAll(/\bname:([^"\s]+)/g)) nameTerms.push(m[1].toLowerCase());
  // cmc<=N or cmc<N
  const cmcMaxM = q.match(/cmc<=(\d+)/);
  if (cmcMaxM) cmcMax = parseInt(cmcMaxM[1]);
  const cmcMinM = q.match(/cmc>=(\d+)/);
  if (cmcMinM) cmcMin = parseInt(cmcMinM[1]);

  // Bare words (no prefix) → name search
  const bare = query
    .replace(/-?o:"[^"]+"/g, '')
    .replace(/-?o:\S+/g, '')
    .replace(/\bt:\S+/g, '')
    .replace(/\bname:"[^"]+"/g, '')
    .replace(/\bname:\S+/g, '')
    .replace(/\b(legal|color|c|cmc|is|format)[:<=>]\S+/g, '')
    .replace(/\bOR\b/gi, '')
    .trim();
  if (bare) nameTerms.push(...bare.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  return pool.filter(card => {
    const oracle = (card.oracle_text ?? '').toLowerCase();
    const type = card.type_line.toLowerCase();
    const name = card.name.toLowerCase();
    if (oTerms.length && !oTerms.every(t => oracle.includes(t))) return false;
    if (oNeg.length && oNeg.some(t => oracle.includes(t))) return false;
    if (tTerms.length && !tTerms.some(t => type.includes(t))) return false;
    if (nameTerms.length && !nameTerms.some(t => name.includes(t))) return false;
    if (cmcMax !== null && card.cmc > cmcMax) return false;
    if (cmcMin !== null && card.cmc < cmcMin) return false;
    return true;
  }).slice(0, limit);
}

async function scryfallNamed(name: string) {
  try {
    const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`, {
      headers: { 'User-Agent': 'Grimoire/1.0' },
    });
    if (!res.ok) return null;
    return await res.json() as { name: string; mana_cost: string; type_line: string; oracle_text: string; cmc: number; color_identity: string[]; prices?: { usd?: string } };
  } catch { return null; }
}

// --- Tool definitions for Gemini ---

const TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: 'search_cards',
    description: 'Search for cards matching a query. Results sorted by EDHREC popularity. Use for finding cards by keyword, mechanic, synergy, or effect.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query using terms like: t:creature, o:"draw a card", name:Fireball, cmc<=3' },
        limit: { type: 'number', description: 'Max results (default 20, max 40)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_card',
    description: 'Get full details for a specific card by exact name.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact card name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_commander_staples',
    description: 'Get top cards for a commander sorted by EDHREC popularity. Always call this first.',
    parameters: {
      type: 'object',
      properties: {
        commander: { type: 'string', description: 'Commander card name' },
        colors: { type: 'array', items: { type: 'string' }, description: 'Color identity letters e.g. ["U","B"]' },
      },
      required: ['commander', 'colors'],
    },
  },
  {
    name: 'check_deck',
    description: 'Analyze current deck state — total count, slots remaining, land count.',
    parameters: {
      type: 'object',
      properties: {
        deck: { type: 'object', description: 'Current deck as a JSON object mapping card name to quantity' },
        target_size: { type: 'number', description: 'Target size (100 for Commander)' },
      },
      required: ['deck', 'target_size'],
    },
  },
  {
    name: 'finalize_deck',
    description: 'Submit the completed deck. Call when deck has correct number of cards.',
    parameters: {
      type: 'object',
      properties: {
        deck: { type: 'object', description: 'Final deck as a JSON object mapping card name to quantity' },
        strategy: { type: 'string', description: 'One paragraph explaining the deck strategy' },
      },
      required: ['deck', 'strategy'],
    },
  },
];

// --- Execute a tool call ---

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  userId: string,
  colorIdentity: string[],
  format: string,
  collectionOnly: boolean,
  ownedCardNames: string[],
  ownedCardPool: CardDetail[],
): Promise<{ result: unknown; summary: string }> {

  if (toolName === 'search_cards') {
    const query = input.query as string;
    const limit = Math.min((input.limit as number) ?? 20, 40);
    let formatted: { name: string; cost: string; type: string; text: string | undefined; cmc: number; colors: string[] }[];

    if (collectionOnly && ownedCardPool.length > 0) {
      const results = searchOwnedPool(ownedCardPool, query, limit);
      formatted = results.map(c => ({
        name: c.name, cost: c.mana_cost, type: c.type_line,
        text: c.oracle_text?.slice(0, 200), cmc: c.cmc, colors: c.color_identity,
      }));
    } else {
      const cards = await scryfallSearch(query, limit);
      formatted = cards.map(c => ({
        name: c.name, cost: c.mana_cost, type: c.type_line,
        text: c.oracle_text?.slice(0, 200), cmc: c.cmc, colors: c.color_identity,
      }));
    }
    return {
      result: formatted,
      summary: `Found ${formatted.length} cards for query "${query}"${collectionOnly ? ' (from your collection)' : ''}`,
    };
  }

  if (toolName === 'get_card') {
    const card = await scryfallNamed(input.name as string);
    if (!card) return { result: null, summary: `Card "${input.name}" not found` };
    return {
      result: {
        name: card.name,
        cost: card.mana_cost,
        type: card.type_line,
        text: card.oracle_text,
        cmc: card.cmc,
        colors: card.color_identity,
        price_usd: card.prices?.usd,
      },
      summary: `Got details for ${card.name}`,
    };
  }

  if (toolName === 'get_commander_staples') {
    const commander = input.commander as string;
    const colors = (input.colors as string[]).join('');
    const colorFilter = colors ? `color<=${colors}` : '';
    // Search for top commander-legal cards in these colors, sorted by EDHREC
    const [staples, commanderCard] = await Promise.all([
      scryfallSearch(`legal:commander ${colorFilter} -t:basic`, 60),
      scryfallNamed(commander),
    ]);
    let formatted: { name: string; cost: string; type: string; text: string | undefined; cmc: number }[];
    if (collectionOnly && ownedCardPool.length > 0) {
      formatted = ownedCardPool.slice(0, 60).map(c => ({
        name: c.name, cost: c.mana_cost, type: c.type_line,
        text: c.oracle_text?.slice(0, 150), cmc: c.cmc,
      }));
    } else {
      formatted = staples.map(c => ({
        name: c.name, cost: c.mana_cost, type: c.type_line,
        text: c.oracle_text?.slice(0, 150), cmc: c.cmc,
      }));
    }
    const commanderInfo = commanderCard ? {
      name: commanderCard.name,
      oracle_text: commanderCard.oracle_text,
      type_line: commanderCard.type_line,
      color_identity: commanderCard.color_identity,
    } : null;
    return {
      result: { commander: commanderInfo, top_cards: formatted },
      summary: `Got commander data and ${formatted.length} top cards for ${commander}`,
    };
  }

  if (toolName === 'check_deck') {
    const deck = input.deck as Record<string, number>;
    const targetSize = (input.target_size as number) ?? 100;
    const counts = analyzeDeck(deck, colorIdentity);
    const cardNames = Object.keys(deck);
    const basics = cardNames.filter(n => BASIC_LANDS.has(n));

    const gaps: string[] = [];
    const total = Object.values(deck).reduce((s, q) => s + q, 0);
    if (total < targetSize) gaps.push(`Need ${targetSize - total} more cards`);

    return {
      result: {
        total,
        target: targetSize,
        remaining_slots: targetSize - total,
        cards_in_deck: cardNames.length,
        basic_lands: basics.reduce((s, n) => s + (deck[n] ?? 0), 0),
        non_basic_lands: cardNames.filter(n => !BASIC_LANDS.has(n) && n !== Object.keys(deck)[0]).length,
        gaps,
      },
      summary: `Deck has ${total}/${targetSize} cards. ${targetSize - total} slots remaining.`,
    };
  }

  if (toolName === 'finalize_deck') {
    // This is handled in the outer loop — just return success here
    return { result: { ok: true }, summary: 'Deck finalized' };
  }

  return { result: null, summary: `Unknown tool: ${toolName}` };
}

// --- SSE helper ---

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const {
    commander,
    format = 'commander',
    commanderColorIdentity = [],
    themes = [],
    archetype,
    psychographic,
    budgetCents,
    ownedCardNames = [],
    collectionOnly = false,
    sessionId,
  } = await req.json() as {
    commander?: string;
    format?: string;
    commanderColorIdentity?: string[];
    themes?: string[];
    archetype?: string;
    psychographic?: string;
    budgetCents?: number;
    ownedCardNames?: string[];
    collectionOnly?: boolean;
    sessionId?: string;
  };

  // Fetch owned cards from DB. If user has a collection, enforce collection-only
  // regardless of what the client flag says (client flag can be wrong due to timing).
  let resolvedOwnedCardNames: string[] = ownedCardNames;
  let resolvedCollectionOnly = false;
  try {
    const rows = await findMany<{ name: string }>(
      `SELECT DISTINCT name FROM inventory_items WHERE "userId" = ? AND "itemType" = 'cards'`,
      [userId]
    );
    if (rows.length > 0) {
      resolvedOwnedCardNames = rows.map(r => r.name);
      resolvedCollectionOnly = true; // always use collection when user has cards
    }
    console.log(`[agent-build] collectionOnly=${collectionOnly} clientOwned=${ownedCardNames.length} dbOwned=${rows.length} resolvedCollectionOnly=${resolvedCollectionOnly}`);
  } catch (e) {
    console.error('[agent-build] DB fetch failed:', e);
    resolvedCollectionOnly = collectionOnly;
  }

  const isCommander = ['commander', 'brawl', 'oathbreaker'].includes(format);
  const deckSize = isCommander ? 100 : 60;
  const colorStr = commanderColorIdentity.join('') || 'WUBRG';

  // Fetch deck building rules
  let rulesDoc = '';
  try {
    const rulesRes = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/deck-wizard/rules-structured`,
      { headers: { cookie: req.headers.get('cookie') ?? '' } }
    );
    if (rulesRes.ok) {
      const d = await rulesRes.json() as { rules: string };
      rulesDoc = d.rules ?? '';
    }
  } catch { /* best effort */ }

  const budgetStr = budgetCents ? `$${(budgetCents / 100).toFixed(0)} total budget — stay under this` : 'no budget constraint';
  const collectionNote = resolvedCollectionOnly && resolvedOwnedCardNames.length > 0
    ? `COLLECTION MODE — HARD CONSTRAINT: The user owns ${resolvedOwnedCardNames.length} cards. You MUST build using ONLY cards they own. Use search_cards and get_commander_staples — those tools automatically search the owned collection so every result is a card they own. Basic lands are always allowed. Do NOT include cards they don't own.`
    : '';

  const systemPrompt = `You are Khoa, an expert Magic: The Gathering deck builder with deep knowledge of Commander strategy.

YOUR TASK: Build a complete ${deckSize}-card ${format} deck.

COMMANDER: ${commander ?? 'none'}
COLOR IDENTITY: ${colorStr}
FORMAT: ${format}
DECK SIZE: ${deckSize} cards (including the commander)
USER THEMES (hints, not hard requirements): ${themes.join(', ') || 'none specified'}
ARCHETYPE HINT: ${archetype ?? 'not specified'}
STYLE: ${psychographic ?? 'balanced'}
BUDGET: ${budgetStr}
${collectionNote}

DECK BUILDING PHILOSOPHY:
1. Use get_card to read the commander's EXACT oracle text first. Identify:
   - What creature types does it care about? (e.g. "Other Villains" → build Villain tribal)
   - What mechanics does it enable? (e.g. hand size, draw triggers, +1/+1 counters)
   - What is the win condition?
2. Then use get_commander_staples to see what's popular with this commander.
3. Build around the commander's SPECIFIC strategy — if it says "Other Villains get +2/+2", fill the deck with that creature type. Do NOT build generic good-stuff.
4. Prioritize cards from the same set or block as the commander — they are designed to synergize.
5. Every non-land card must answer: "does this directly support the commander's strategy?"
6. MANA BASE: Include mana rocks (Arcane Signet, signets, talismans) AND quality dual lands, not just basics. Aim for 36-38 lands total with ~8-10 mana rocks.
7. Use search_cards to find synergistic cards — search for the specific creature type, mechanic, or keyword the commander cares about.
8. Use check_deck to track progress. When at ${deckSize} cards, call finalize_deck.

SINGLETON RULE: In Commander, each card (except basic lands) may only appear once.

${rulesDoc ? `DECK BUILDING RULES:\n${rulesDoc.slice(0, 2000)}` : ''}

Think step by step: read the commander → identify its strategy → find synergistic cards → build support → add lands.`;

  const geminiContents: GeminiContent[] = [
    {
      role: 'user',
      parts: [{ text: `Build a ${format} deck${commander ? ` with ${commander} as the commander` : ''}. First, use get_card to read ${commander ?? 'the commander'}'s oracle text and identify its creature type synergies and strategy. Then search for cards that match that specific strategy. Build a complete ${deckSize}-card deck focused on the commander's strengths.` }],
    },
  ];

  const encoder = new TextEncoder();
  let finalDeck: Record<string, number> | null = null;
  let finalStrategy = '';
  let iterationCount = 0;
  const MAX_ITERATIONS = 30;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      try {
        // Pre-fetch owned card pool with Scryfall details for collection-only mode
        let ownedCardPool: CardDetail[] = [];
        if (resolvedCollectionOnly && resolvedOwnedCardNames.length > 0) {
          send(sseEvent('status', { text: `Loading your collection (${resolvedOwnedCardNames.length} cards)…` }));
          ownedCardPool = await fetchOwnedCardPool(resolvedOwnedCardNames, commanderColorIdentity);
          send(sseEvent('status', { text: `Found ${ownedCardPool.length} cards in your collection matching this commander's colors.` }));
        }

        while (iterationCount < MAX_ITERATIONS && !finalDeck) {
          iterationCount++;
          // Small inter-iteration pause to stay under rate limits (skip first call)
          if (iterationCount > 1) await new Promise(r => setTimeout(r, 800));

          // Warn agent when running low
          const contents = [...geminiContents];
          if (iterationCount >= MAX_ITERATIONS - 5) {
            contents.push({
              role: 'user',
              parts: [{ text: `You have ${MAX_ITERATIONS - iterationCount} iterations remaining. Call finalize_deck now with whatever cards you have.` }],
            });
          }

          const response = await geminiWithTools(systemPrompt, contents, TOOLS);
          if (!response) {
            send(sseEvent('error', { message: 'Gemini API call failed (no response).' }));
            controller.close();
            return;
          }

          // Surface API errors in the feed
          const errorPart = response.parts.find(p => 'text' in p && p.text.startsWith('[gemini-error]'));
          if (errorPart && 'text' in errorPart) {
            send(sseEvent('error', { message: errorPart.text }));
            controller.close();
            return;
          }

          // Stream text parts
          for (const part of response.parts) {
            if ('text' in part && part.text.trim()) {
              send(sseEvent('thinking', { text: part.text.trim() }));
            }
          }

          // Collect function calls
          const functionCalls = response.parts.filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p);

          if (functionCalls.length === 0) {
            // Model finished without calling a tool — try to extract JSON from text
            for (const part of response.parts) {
              if ('text' in part && part.text.includes('"deck"')) {
                try {
                  const parsed = JSON.parse(extractJson(part.text)) as { deck: Record<string, number>; strategy: string };
                  if (parsed.deck) { finalDeck = parsed.deck; finalStrategy = parsed.strategy ?? ''; }
                } catch { /* ignore */ }
              }
            }
            break;
          }

          // Add model turn to history
          geminiContents.push({ role: 'model', parts: response.parts });

          // Execute each function call and collect responses
          const responseParts: GeminiPart[] = [];
          for (const fc of functionCalls) {
            const { name, args } = fc.functionCall;
            send(sseEvent('tool_call', { tool: name, input: args }));

            if (name === 'finalize_deck') {
              const submittedDeck = args.deck as Record<string, number>;
              const submittedTotal = Object.values(submittedDeck).reduce((s, q) => s + q, 0);
              const minNonLand = Math.floor(deckSize * 0.55); // at least 55 non-land cards for a 100-card deck
              if (submittedTotal < minNonLand) {
                // Reject and ask for more cards
                responseParts.push({ functionResponse: { name, response: { name, content: { ok: false, error: `Deck only has ${submittedTotal} cards. You need at least ${minNonLand} non-land cards before finalizing. Keep adding cards.` } } } });
              } else {
                finalDeck = submittedDeck;
                finalStrategy = (args.strategy as string) ?? '';
                send(sseEvent('finalizing', { text: 'Building complete — filling basics…' }));
                responseParts.push({ functionResponse: { name, response: { name, content: { ok: true } } } });
              }
            } else {
              const { result, summary } = await executeTool(
                name, args, userId, commanderColorIdentity, format,
                resolvedCollectionOnly, resolvedOwnedCardNames, ownedCardPool,
              );
              send(sseEvent('tool_result', { tool: name, summary }));
              responseParts.push({ functionResponse: { name, response: { name, content: result } } });
            }
          }

          // Add tool responses to history
          geminiContents.push({ role: 'user', parts: responseParts });

          if (finalDeck) break;
        }

        if (!finalDeck) {
          send(sseEvent('error', { message: 'Agent did not produce a deck within the iteration limit.' }));
          controller.close();
          return;
        }

        // Fill basics via fill-basics route
        send(sseEvent('status', { text: 'Filling basic lands…' }));
        try {
          const basicsRes = await fetch(
            `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/deck-wizard/fill-basics`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
              body: JSON.stringify({
                cards: Object.entries(finalDeck).map(([name, quantity]) => ({ name, quantity })),
                deckSize,
                colorIdentity: commanderColorIdentity,
                minLands: isCommander ? 35 : 22,
              }),
            }
          );
          if (basicsRes.ok) {
            const basicsData = await basicsRes.json() as { basics: Record<string, number> };
            if (basicsData.basics) Object.assign(finalDeck, basicsData.basics);
          }
        } catch { /* best effort */ }

        // Enforce collection filter: strip any non-owned cards (basic lands exempt)
        if (resolvedCollectionOnly && resolvedOwnedCardNames.length > 0) {
          const ownedSet = new Set(resolvedOwnedCardNames.map(n => n.toLowerCase()));
          const filtered: Record<string, number> = {};
          for (const [name, qty] of Object.entries(finalDeck)) {
            if (BASIC_LANDS.has(name) || ownedSet.has(name.toLowerCase())) {
              filtered[name] = qty;
            }
          }
          finalDeck = filtered;
        }

        send(sseEvent('complete', { deck: finalDeck, strategy: finalStrategy }));
        controller.close();

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        send(sseEvent('error', { message: msg }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
