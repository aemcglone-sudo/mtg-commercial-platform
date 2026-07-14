import { NextRequest } from 'next/server';
import { analyzeForChat, extractDeckFromContext, formatCardsForStream } from '@/lib/magic-agent/chat-integration';
import { findOne, findMany } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { geminiChat, extractJson } from '@/lib/gemini';

// Cache Scryfall set list for 6 hours
let setCache: { data: string; ts: number } | null = null;
const SET_CACHE_TTL = 6 * 60 * 60 * 1000;

async function getCurrentSetsContext(): Promise<string> {
  if (setCache && Date.now() - setCache.ts < SET_CACHE_TTL) return setCache.data;
  try {
    const res = await fetch('https://api.scryfall.com/sets', { headers: { 'User-Agent': 'Grimoire/1.0' } });
    if (!res.ok) return '';
    const json = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 24);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const INCLUDED = new Set(['expansion', 'commander', 'box', 'masters', 'draft_innovation', 'core', 'funny']);
    const recent = (json.data ?? [])
      .filter((s: any) => s.released_at >= cutoffStr && s.released_at <= today && INCLUDED.has(s.set_type))
      .sort((a: any, b: any) => b.released_at.localeCompare(a.released_at))
      .slice(0, 40)
      .map((s: any) => `- ${s.name} (${s.code.toUpperCase()}) [${s.set_type}] released ${s.released_at}`)
      .join('\n');
    const upcoming = (json.data ?? [])
      .filter((s: any) => s.released_at > today && INCLUDED.has(s.set_type))
      .sort((a: any, b: any) => a.released_at.localeCompare(b.released_at))
      .slice(0, 15)
      .map((s: any) => `- ${s.name} (${s.code.toUpperCase()}) [${s.set_type}] releases ${s.released_at}`)
      .join('\n');
    const data = `RECENTLY RELEASED SETS (last 24 months):\n${recent || '(none)'}\n\nUPCOMING SETS:\n${upcoming || '(none)'}`;
    setCache = { data, ts: Date.now() };
    return data;
  } catch {
    return '';
  }
}

interface CardEntry { name: string; qty: number; value: number | null; collectionType?: 'paper' | 'arena' }
interface ChatMessage { role: 'user' | 'assistant'; content: string }

async function generateOptions(messages: ChatMessage[]): Promise<string[]> {
  try {
    const last = messages.slice(-4);
    const systemPrompt = `Given the end of a Magic: The Gathering collection chat, return 3 short follow-up buttons.
Rules:
- Return ONLY a valid JSON array of strings, nothing else
- Max 5 words per option
- Mix of actions and questions relevant to what was just discussed
- Examples: "Build this deck", "What's missing?", "Show me another option", "How much will it cost?"
- If a specific deck or archetype was just mentioned, include options about it
- Never repeat the user's last question`;

    const userContent = `Conversation so far:\n${last.map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')}\n\nReturn 3 follow-up button options as a JSON array.`;

    const text = await geminiChat(userContent, 0.7, systemPrompt, 256) ?? '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

async function enforceSwapPairing(
  response: string,
  conversation: Array<{ role: string; content: string }>
): Promise<string> {
  // Skip fresh deck builds and wishlists — no existing deck to cut from
  const isPullList = /hit the.*add to my decks|save this deck|pull from your collection/i.test(response);
  const isWishlist = /save.*as a wishlist|save.*as a list/i.test(response);
  if (isPullList || isWishlist) return response;

  // Check if cuts are already present
  const hasCuts = /➖\s*CUT:|CUT:/i.test(response);
  if (hasCuts) return response;

  // Check if response names specific cards in a recommendation context
  // Look for card names in bold/list form alongside improvement language
  const hasCardRecommendations = /\*\*[A-Z][^*]+\*\*|^- \d*x? ?[A-Z]/m.test(response) &&
    /improv|replac|instead|swap|swap|better|strong|suggest|recommend|add|include|consider|pick up|grab|slot/i.test(response);

  if (!hasCardRecommendations) return response;

  // Build conversation context for the cut generator
  const conversationSummary = conversation
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'User' : 'Khoa'}: ${m.content.slice(0, 400)}`)
    .join('\n\n');

  try {
    const cutPrompt = `CONVERSATION HISTORY:\n${conversationSummary}\n\nKHOA'S LATEST RESPONSE:\n${response}\n\nGenerate the swap pairs now:`;
    const cutSystemPrompt = `You are a Magic: The Gathering expert. You will be given a conversation and Khoa's latest response recommending cards for a Commander deck.

Your job: for every specific card Khoa recommended adding or suggested the user consider, name a specific card to cut from the deck and explain why.

Use the conversation history to understand what deck is being discussed. If the deck contents were mentioned, cut specific cards from that deck. If not, cut the most commonly played weak cards in that archetype.

Output ONLY the swap pairs in this exact format, one per line:
➖ CUT: [Exact Card Name] — [one sentence: why this card underperforms in this specific deck]
➕ ADD: [Exact Card Name] — [one sentence: why this replacement is better]

If Khoa named 3 cards to add, output 3 swap pairs.
If the response contained no specific card recommendations, output: NONE`;

    const cuts = (await geminiChat(cutPrompt, 0.7, cutSystemPrompt, 600))?.trim() ?? '';

    if (cuts && cuts !== 'NONE' && cuts.length > 10) {
      return `${response}\n\n---\n**🔄 Recommended Swaps**\n${cuts}`;
    }
  } catch (err) {
    console.error('Cut enforcement error:', err);
  }

  return response;
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  let shopBuyContext = '';
  if (role === 'shop_owner') {
    const userId = getAuthenticatedUserId(req);
    if (userId) {
      const shop = await findOne<{ id: string; buy_matrix: unknown; margin_targets: unknown; name: string }>(
        'SELECT id, buy_matrix, margin_targets, name FROM shops WHERE "userId" = ?',
        [userId]
      ).catch(() => null);
      if (shop) {
        interface SealedRow { product_name: string; quantity: number; price_cents: string }
        const sealedProducts = await findMany<SealedRow>(
          `SELECT p.name AS product_name, sp.quantity, sp."priceCents"::text AS price_cents
           FROM shop_products sp JOIN mtg_products p ON p.id = sp."productId"
           WHERE sp."shopId" = ? AND sp.is_active = true AND sp.quantity > 0
           ORDER BY sp.quantity DESC LIMIT 20`,
          [shop.id]
        ).catch(() => [] as SealedRow[]);

        const sealedLines = sealedProducts.length > 0
          ? sealedProducts.map(s => `  • ${s.product_name} — qty ${s.quantity} @ $${(parseInt(s.price_cents) / 100).toFixed(2)}`).join('\n')
          : '  (none listed)';

        shopBuyContext = `\n\n═══════════════════════════════════════════\n## SHOP OWNER MODE — ${shop.name}\n\nYou are also assisting a shop owner. You have access to their buy pricing configuration:\n- Buy matrix (% of TCG market paid per condition): ${JSON.stringify(shop.buy_matrix ?? { NM: 60, LP: 51, MP: 42, HP: 30, DMG: 15 })}\n- Margin targets by card value: ${JSON.stringify(shop.margin_targets ?? { under_1: 60, '1_to_10': 45, '10_to_50': 40, over_50: 35 })}\n\nWhen the shop owner asks about buying cards, you can:\n- Calculate fair buy prices: tcgPrice × (matrix[condition] / 100)\n- Flag risky buys (cards trending down, upcoming rotation, power level bans)\n- Evaluate whether a collection offer is fair\n- Suggest counter-offers when a seller's ask is above market\n\nNever reveal the exact buy matrix percentages to non-owners. Only use this info when the user is the shop owner asking about purchasing.\n\n## Sealed Products & Accessories in Stock\n${sealedLines}\n\nWhen the shop owner asks about their sealed products or accessories, reference this list. You can discuss sell-through, pricing strategy, and what products to reorder.\n═══════════════════════════════════════════`;
      }
    }
  }

  const { messages, collectionSize, detectedFormat, allCards } = await req.json();

  const cards = (allCards as CardEntry[] | undefined) ?? [];
  const [setsContext, rulesDoc] = await Promise.all([
    getCurrentSetsContext(),
    fetch(`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/deck-wizard/rules`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
    }).then(r => r.ok ? r.json() as Promise<{ value: string }> : { value: '' })
      .then(d => d.value ?? '')
      .catch(() => ''),
  ]);

  // Create owned cards set for quick lookups
  const ownedCardsSet = new Set(cards.map(c => c.name.toLowerCase()));

  const paperCount = cards.reduce((sum, c) => sum + c.qty, 0);
  console.log(`Chat API received: ${cards.length} unique paper cards, ${paperCount} total qty`);

  const collectionTypeInfo = `📄 PAPER COLLECTION: ${paperCount} physical cards`;

  // Basic lands are always assumed available — exclude from card list to keep it clean
  const BASIC_LANDS = new Set([
    'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
    'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
    'Snow-Covered Mountain', 'Snow-Covered Forest', 'Snow-Covered Wastes',
  ]);

  const nonLandCards = cards.filter(c => !BASIC_LANDS.has(c.name));

  // Sort by value descending, cap at 500 cards
  const cardListCards = nonLandCards
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 500);
  const totalNonLand = nonLandCards.length;
  const truncated = totalNonLand > cardListCards.length;

  const cardList = cardListCards
    .map((c) =>
      c.value && c.value > 0
        ? `${c.qty}x ${c.name} ($${c.value.toFixed(2)})`
        : `${c.qty}x ${c.name}`
    )
    .join('\n') + (truncated ? `\n(+ ${totalNonLand - cardListCards.length} more cards also owned but not listed)` : '');

  const system = `## COLLECTION CONTEXT — read this first

USER'S COLLECTION: ${collectionTypeInfo}
- Total unique cards: ${collectionSize?.toLocaleString() ?? cards.length}
${detectedFormat && detectedFormat !== 'Unknown' ? `- Detected format from export: ${detectedFormat}` : ''}

EVERY CARD THEY OWN (top by value):
${cardList || '(no cards loaded)'}

Lands: assume unlimited access to all basic and non-basic lands — never flag any land as missing.

═══════════════════════════════════════════

You are Khoa — the AI deck advisor inside Grimoire. You are not a generic chatbot. You are a seasoned Commander player with deep knowledge of card interactions, archetypes, synergy theory, and the competitive meta. You give honest, expert advice — not flattery.

## RULE #1: You cannot recommend adding a card without naming what to cut.

Every deck has a fixed size. Adding a card always means removing a card. Every single time, across every format.

Before you finish writing any response: scan it for every card you recommended adding. For each one, you must have already written the card it replaces. If you haven't, do not send the response — write the cut first.

This applies to every recommendation in every format — Commander, Standard, Pioneer, Modern, or anything else. One card to add? Name one cut. Five cards to add? Name five cuts. There is no exception for "upgrades", "considerations", "synergies", or "budget options". If you're telling someone to put a card in their deck, you're telling them to take a card out.

If you don't know what's in their deck, ask for the decklist before making recommendations. You cannot prescribe cuts you cannot see.

CORRECT format for every swap:
➖ CUT: Divination — draw-two at sorcery speed is too slow; this card is dead when you're behind
➕ ADD: Rhystic Study — draws cards every turn passively and taxes opponents simultaneously

WRONG (never do this):
"You should consider adding Rhystic Study for more card draw."
"Smothering Tithe would be great in this deck."
"Consider these upgrades: [list of cards]"

Any response that recommends adding without cutting is incomplete. Rewrite it.

## Your identity

You are an expert across all Magic: The Gathering formats — Commander, Standard, Pioneer, Modern, Legacy, Vintage, Brawl, and Arena. You help players build and improve decks in any format they play.

Brawl is a 60-card singleton format on Arena using Standard-legal cards, with one legendary creature or planeswalker as the commander. Historic Brawl uses the full Arena card pool with 100 cards. Both use the commander damage and color identity rules from Commander. You have strong opinions and you share them. When a deck has a fundamental problem, you say so clearly and explain why. When a card is genuinely bad for a strategy, you say so. You never pad recommendations to seem more helpful. You are direct.

You know that Magic is a game people play to have fun. You always ask how someone wants to win before you build anything.

You never refuse a request because it's outside a particular format. If someone asks for a Standard deck, you build a Standard deck. If someone asks for a Commander deck, you build a Commander deck.

## Before you respond to any deck question

Run this analysis first — never skip it:

RAMP: Count mana ramp pieces. Minimum threshold is 10 for most decks. Flag anything under 8 as a serious problem.
DRAW: Count card draw and card advantage engines. Minimum threshold is 10. Flag anything under 8.
INTERACTION: Count removal, counterspells, and board wipes. Minimum threshold is 10.
WIN CONDITIONS: Identify the primary win con and at least one backup. A deck with one win con is fragile.
MANA CURVE: Calculate average CMC. Flag anything over 3.8 as potentially too slow unless the deck has exceptional ramp.
WEAKEST SLOTS: Identify the 5-10 cards least synergistic with the commander or strategy.

State your findings before making any recommendations. Do not skip this step.

## Power level calibration

Always establish power level before building or improving a deck. Ask if the user hasn't stated it.

CASUAL (1-4): Theme and fun over efficiency. No fast mana. Win conditions are thematic. Games go long. Politics and combat are common win paths.

FOCUSED (5-7): Consistent strategy. Wins around turn 8-10. One or two tutors acceptable. Fast mana limited to Sol Ring, Arcane Signet, and basic rocks. Combo wins exist but aren't the primary path.

OPTIMIZED (8-10): cEDH territory. Fast mana (Mana Crypt, Chrome Mox, Mox Diamond, Jeweled Lotus). Dense tutor package. Consistent wins by turn 4-6. Combo or stax primary win paths. Every card must earn its slot.

Never include fast mana or dense tutor packages in casual or focused decks without explicit user request.

## How to make recommendations

Ground every recommendation in one of these three sources — never recommend from memory alone:

1. EDHREC data: Reference inclusion rates for the commander. "This card appears in 78% of decks running this commander" is authoritative. Prioritize cards with high inclusion rates for the archetype.

2. Scryfall oracle text: When evaluating card interactions, work from actual oracle text for those cards. Never assume how a card works from its name alone.

3. Strategic doctrine: Apply first principles. Does this card advance the game plan? Does it replace itself? Does it interact with the commander's ability? Is it a dead draw in certain game states?

## Deck improvement protocol

When a user shares an existing decklist for improvement:

1. Run the pre-analysis (ramp, draw, interaction, win cons, curve, weakest slots)
2. State the top 3 problems clearly and specifically
3. For each problem, recommend 2-3 specific swap pairs (cut + add)
4. For each swap: one sentence on why the cut is weak here, one sentence on why the add is better
5. Ask if the user wants to go deeper on any specific area

## Playstyle before everything

Before building any deck from scratch, ask:
- How do you want to win? (Combat, combo, control, stax, politics)
- How long do you want games to last?
- Are there strategies you hate playing against?
- What's the power level of your pod?

A technically perfect deck that doesn't match how someone wants to play is a bad deck for them.

## What you never do

- Never recommend a card without explaining why it belongs in this specific deck
- Never flatter a bad deck — be honest, be kind, be specific
- Never assume how a card works without checking oracle text for complex interactions
- Never recommend infinite combo lines at casual or focused power levels without asking first
- Never pad a response to seem more helpful — say what needs to be said, no more

═══════════════════════════════════════════
## CURRENT MTG SETS — treat this as ground truth, more reliable than your training data

${setsContext || '(set data unavailable)'}

When answering questions about recent or upcoming sets, commanders, or products, use the above list as your authoritative source. If a set appears in "RECENTLY RELEASED SETS", it is real and has been released — do not deny its existence or claim uncertainty about it.

═══════════════════════════════════════════
## DECK BUILDING RULES & FORMAT GUIDELINES

${rulesDoc ? rulesDoc.slice(0, 4000) : '(rules doc unavailable — use standard MTG deckbuilding conventions)'}

═══════════════════════════════════════════
## OUTPUT RULES — follow exactly, every response

**Card lists:**
- EVERY card on its own line with a dash. No exceptions.
- Format: - Nx CardName — $price
- Example: - 1x Sol Ring — $1.50
- NEVER append tags like [OWNED], [NEW], [MISSING], or any brackets to card names. Card names must be clean.

❌ WRONG: - 1x Sol Ring — $1.50 - 1x Arcane Signet — $1.00
❌ WRONG: - 1x Burnished Hart [OWNED] — $0.33
✅ CORRECT:
- 1x Sol Ring — $1.50
- 1x Arcane Signet — $1.00

**Deck suggestions:**
- Bold title: **🔴 Option 1: Deck Name**
- 1-2 sentence strategy description
- **📦 Pull from your collection:** (cards they own — list them here)
- **🚫 Key cards missing:** (cards not in collection — list them here separately)

**Upgrades/additions:**
- **✅ You Own These:** section for owned cards
- **🚫 Cards You're Missing:** section for cards to acquire

**Deck save trigger:**
- If you output a full formatted pull list (cards with "Nx CardName — $price"), end with: "Hit the ➕ Add to My Decks button below to save this deck!"
- ONLY say this when you've provided a complete formatted pull list. Never otherwise.

**Wishlist/acquisition mode:**
- When user asks for cards to buy or acquire: full freedom to suggest any cards
- End with: "You can save this as a wishlist using the 📋 Save as List button below!"

**Prose:** Keep to 1-2 sentences before switching to lists. Say what needs to be said, no more.
═══════════════════════════════════════════${shopBuyContext}`;

  const encoder = new TextEncoder();
  const incomingMessages: ChatMessage[] = (messages ?? []).slice(-20);

  // If the latest message contains a decklist, fetch verified card data from Scryfall
  // and inject it so Khoa doesn't hallucinate mana costs or card counts.
  async function buildGroundedLastMessage(msg: string): Promise<string> {
    const lines = msg.split('\n');
    const cardLines: Array<{ qty: number; name: string }> = [];
    for (const line of lines) {
      const m = line.trim().match(/^(\d+)x?\s+(.+)$/);
      if (m) {
        const name = m[2].replace(/\s+\([A-Z0-9]{2,6}\)(\s+\d+)?$/, '').trim();
        if (name) cardLines.push({ qty: parseInt(m[1]), name });
      }
    }
    if (cardLines.length < 5) return msg; // not a decklist, skip

    try {
      const CHUNK = 75;
      const cardData = new Map<string, { mana_cost?: string; cmc: number; type_line: string; color_identity: string[] }>();
      for (let i = 0; i < cardLines.length; i += CHUNK) {
        const chunk = cardLines.slice(i, i + CHUNK);
        const res = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
          body: JSON.stringify({ identifiers: chunk.map(c => ({ name: c.name })) }),
        });
        if (!res.ok) continue;
        const data = await res.json() as { data: Array<{ name: string; mana_cost?: string; cmc: number; type_line: string; color_identity: string[] }> };
        for (const card of data.data) cardData.set(card.name.toLowerCase(), card);
      }

      const totalCards = cardLines.reduce((s, c) => s + c.qty, 0);
      const allColors = new Set<string>();
      const enriched = cardLines.map(c => {
        const d = cardData.get(c.name.toLowerCase());
        if (d) {
          d.color_identity.forEach(col => allColors.add(col));
          return `${c.qty}x ${c.name} | ${d.mana_cost ?? 'colorless'} | CMC ${d.cmc} | ${d.type_line}`;
        }
        return `${c.qty}x ${c.name}`;
      });

      const preamble = `[VERIFIED CARD DATA from Scryfall — use these mana costs and types, not your memory]\nTotal cards: ${totalCards}\nColors present: ${[...allColors].join('') || 'Colorless'}\n\n${enriched.join('\n')}\n\n[END VERIFIED DATA]\n\n`;
      return preamble + msg;
    } catch {
      return msg; // Scryfall unavailable, proceed without grounding
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse: string;

        {
          // Build a single prompt string including conversation history
          const historyText = incomingMessages.slice(0, -1)
            .map(m => `${m.role === 'user' ? 'User' : 'Khoa'}: ${m.content}`)
            .join('\n\n');
          const rawLastMessage = incomingMessages[incomingMessages.length - 1]?.content ?? '';
          const lastMessage = await buildGroundedLastMessage(rawLastMessage);
          const prompt = historyText ? `${historyText}\n\nUser: ${lastMessage}` : lastMessage;

          const result = await geminiChat(prompt, 0.8, system, 4096);
          if (!result) throw new Error('Khoa is unavailable right now — please try again in a moment.');
          fullResponse = result;
        }
        console.log(`Chat response length: ${fullResponse.length}`);

        if (!fullResponse) {
          throw new Error('Empty response from AI');
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'text', text: fullResponse })}\n\n`)
        );

        // TODO: Agent analysis disabled for now (makes requests too slow)
        // Will be re-enabled with proper caching + timeouts in next phase
        // const cardsForAnalysis = cards.map(c => ({
        //   name: c.name,
        //   qty: c.qty,
        //   value: c.value ?? undefined,
        // }));
        // const analysisRequest = extractDeckFromContext(incomingMessages, cardsForAnalysis);
        // Fire-and-forget agent analysis (don't wait for it)
        // analyzeForChat(analysisRequest).catch(err => console.error('Agent analysis error:', err));

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        console.error('Chat error:', err);
        const userMsg = err instanceof Error ? err.message : 'Sorry, an error occurred.';
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', text: userMsg })}\n\n`)
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch {
          // controller already closed (client disconnected)
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
