import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany } from '@/lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  // Parse simple Scryfall-like query: extract o:"..." and t: terms for local filtering
  const oTerms: string[] = [];
  const tTerms: string[] = [];
  const nameTerms: string[] = [];

  const oMatches = query.matchAll(/o:"([^"]+)"/g);
  for (const m of oMatches) oTerms.push(m[1].toLowerCase());

  const oSimple = query.matchAll(/\bo:(\S+)/g);
  for (const m of oSimple) if (!m[1].startsWith('"')) oTerms.push(m[1].toLowerCase());

  const tMatches = query.matchAll(/\bt:(\S+)/g);
  for (const m of tMatches) tTerms.push(m[1].toLowerCase());

  // Any bare words (not prefixed) treated as name search
  const bare = query.replace(/\b(legal|color|cmc|o|t|is|format)[:<=>\w"]+/g, '').trim();
  if (bare) nameTerms.push(...bare.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  return pool.filter(card => {
    const oracle = (card.oracle_text ?? '').toLowerCase();
    const type = card.type_line.toLowerCase();
    const name = card.name.toLowerCase();
    if (oTerms.length && !oTerms.every(t => oracle.includes(t))) return false;
    if (tTerms.length && !tTerms.some(t => type.includes(t))) return false;
    if (nameTerms.length && !nameTerms.some(t => name.includes(t) || oracle.includes(t))) return false;
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

// --- Tool definitions for Claude ---

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_cards',
    description: 'Search Scryfall for cards matching a query. Results are sorted by EDHREC popularity. Use for finding cards by keyword, mechanic, synergy, or effect. Include color/format constraints in the query using Scryfall syntax.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Scryfall search query. Examples: "t:ninja legal:commander color<=UB", "o:ninjutsu legal:commander color<=UB", "o:\"draw a card\" t:creature legal:commander color<=G"' },
        limit: { type: 'number', description: 'Max results to return (default 20, max 40)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_card',
    description: 'Get full details for a specific card by exact name. Use to inspect oracle text, cost, or confirm a card exists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Exact card name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_commander_staples',
    description: 'Get the most popular cards played with a specific commander, ordered by EDHREC rank. Always call this first for any commander deck.',
    input_schema: {
      type: 'object' as const,
      properties: {
        commander: { type: 'string', description: 'Commander card name' },
        colors: { type: 'array', items: { type: 'string' }, description: 'Color identity letters e.g. ["U","B"]' },
      },
      required: ['commander', 'colors'],
    },
  },
  {
    name: 'check_deck',
    description: 'Analyze the current deck. Returns total card count, land count, and role breakdown. Call this to know where you stand and what gaps remain.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deck: { type: 'object', description: 'Current deck as {cardName: quantity}', additionalProperties: { type: 'number' } },
        target_size: { type: 'number', description: 'Target deck size (100 for Commander)' },
      },
      required: ['deck', 'target_size'],
    },
  },
  {
    name: 'finalize_deck',
    description: 'Submit the completed deck. Call this only when the deck has the correct number of cards (100 for Commander) and meets all requirements. Pass the complete deck list.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deck: { type: 'object', description: 'Final deck as {cardName: quantity}', additionalProperties: { type: 'number' } },
        strategy: { type: 'string', description: 'One paragraph explaining the deck strategy and win conditions' },
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

  // Fetch owned cards from DB server-side — don't trust the client array (may be empty due to timing)
  let resolvedOwnedCardNames = ownedCardNames;
  if (collectionOnly) {
    try {
      const rows = await findMany<{ name: string }>(
        `SELECT DISTINCT name FROM inventory_items WHERE "userId" = ? AND "itemType" = 'cards'`,
        [userId]
      );
      if (rows.length > 0) resolvedOwnedCardNames = rows.map(r => r.name);
    } catch { /* fall back to client-provided list */ }
  }

  // Pre-fetch full owned card pool when in collection-only mode
  let ownedCardPool: CardDetail[] = [];
  if (collectionOnly && resolvedOwnedCardNames.length > 0) {
    ownedCardPool = await fetchOwnedCardPool(resolvedOwnedCardNames, commanderColorIdentity);
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
  const collectionNote = collectionOnly && resolvedOwnedCardNames.length > 0
    ? `COLLECTION MODE (HARD CONSTRAINT): You MUST use ONLY cards from the user's collection. Do NOT suggest any card not on this list. Every single non-land card in the final deck must appear in this owned list:\n${resolvedOwnedCardNames.slice(0, 600).join(', ')}`
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
1. Research the commander FIRST using get_commander_staples — understand its strategy before picking any cards
2. Build around the commander's specific win condition, not generic good-stuff
3. Every card must answer: "does this help the commander's strategy?"
4. Targets for Commander: 36-38 lands (including commander), 10 ramp spells, 10 draw effects, 10-12 removal, 28-32 synergy/engine cards
5. Use search_cards and get_card to find specific cards for specific needs — do not guess at card names
6. Use check_deck regularly to track progress and gaps
7. When the deck reaches ${deckSize} cards, call finalize_deck

SINGLETON RULE: In Commander, each card (except basic lands) may only appear once.

${rulesDoc ? `DECK BUILDING RULES:\n${rulesDoc.slice(0, 2000)}` : ''}

Think step by step. Research first, then build the engine, then support, then lands. Do not rush to finalize.`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Build a ${format} deck${commander ? ` with ${commander} as the commander` : ''}. Start by researching the commander, then build a complete ${deckSize}-card deck. Think through the strategy carefully before picking cards.`,
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
        send(sseEvent('status', { text: 'Khoa is thinking…' }));

        while (iterationCount < MAX_ITERATIONS && !finalDeck) {
          iterationCount++;

          const response = await anthropic.messages.create({
            model: 'claude-sonnet-5',
            max_tokens: 8000,
            system: systemPrompt,
            tools: TOOLS,
            messages,
          });

          // Stream any text content
          for (const block of response.content) {
            if (block.type === 'text' && block.text.trim()) {
              send(sseEvent('thinking', { text: block.text.trim() }));
            }
          }

          // If the model is done
          if (response.stop_reason === 'end_turn') {
            // Try to extract deck from text if finalize_deck wasn't called
            const textBlock = response.content.find(b => b.type === 'text');
            if (textBlock && textBlock.type === 'text') {
              const match = textBlock.text.match(/\{"deck"\s*:/);
              if (match) {
                try {
                  const parsed = JSON.parse(textBlock.text.slice(textBlock.text.indexOf('{'))) as { deck: Record<string, number>; strategy: string };
                  finalDeck = parsed.deck;
                  finalStrategy = parsed.strategy ?? '';
                } catch { /* couldn't parse */ }
              }
            }
            break;
          }

          // Process tool calls
          if (response.stop_reason === 'tool_use') {
            const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of toolUseBlocks) {
              if (block.type !== 'tool_use') continue;

              send(sseEvent('tool_call', { tool: block.name, input: block.input }));

              if (block.name === 'finalize_deck') {
                const input = block.input as { deck: Record<string, number>; strategy: string };
                finalDeck = input.deck;
                finalStrategy = input.strategy ?? '';
                send(sseEvent('finalizing', { text: 'Building complete — filling basics and scoring…' }));
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true }) });
              } else {
                const { result, summary } = await executeTool(
                  block.name,
                  block.input as Record<string, unknown>,
                  userId,
                  commanderColorIdentity,
                  format,
                  collectionOnly,
                  resolvedOwnedCardNames,
                  ownedCardPool,
                );
                send(sseEvent('tool_result', { tool: block.name, summary }));
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
              }
            }

            // Add assistant response + tool results to history
            messages.push({ role: 'assistant', content: response.content });
            messages.push({ role: 'user', content: toolResults });

            if (finalDeck) break;
          }
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
        if (collectionOnly && resolvedOwnedCardNames.length > 0) {
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
