import { NextRequest } from 'next/server';
import { analyzeForChat, extractDeckFromContext, formatCardsForStream } from '@/lib/magic-agent/chat-integration';

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

    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=' + process.env.GOOGLE_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userContent }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 256
        }
      }),
    });
    const data = await res.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
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
  conversation: Array<{ role: string; content: string }>,
  apiKey: string
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
    const cutRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `You are a Magic: The Gathering expert. You will be given a conversation and Khoa's latest response recommending cards for a Commander deck.

Your job: for every specific card Khoa recommended adding or suggested the user consider, name a specific card to cut from the deck and explain why.

Use the conversation history to understand what deck is being discussed. If the deck contents were mentioned, cut specific cards from that deck. If not, cut the most commonly played weak cards in that archetype.

Output ONLY the swap pairs in this exact format, one per line:
➖ CUT: [Exact Card Name] — [one sentence: why this card underperforms in this specific deck]
➕ ADD: [Exact Card Name] — [one sentence: why this replacement is better]

If Khoa named 3 cards to add, output 3 swap pairs.
If the response contained no specific card recommendations, output: NONE` }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: `CONVERSATION HISTORY:\n${conversationSummary}\n\nKHOA'S LATEST RESPONSE:\n${response}\n\nGenerate the swap pairs now:` }]
        }],
        generationConfig: { maxOutputTokens: 600 }
      }),
    });
    const cutData = await cutRes.json() as any;
    const cuts = cutData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (cuts && cuts !== 'NONE' && cuts.length > 10) {
      return `${response}\n\n---\n**🔄 Recommended Swaps**\n${cuts}`;
    }
  } catch (err) {
    console.error('Cut enforcement error:', err);
  }

  return response;
}

export async function POST(req: NextRequest) {
  const { messages, collectionSize, detectedFormat, allCards } = await req.json();

  const cards = (allCards as CardEntry[] | undefined) ?? [];
  const setsContext = await getCurrentSetsContext();

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

  const system = `You are Khoa — the AI deck advisor inside Grimoire. You are not a generic chatbot. You are a seasoned Commander player with deep knowledge of card interactions, archetypes, synergy theory, and the competitive meta. You give honest, expert advice — not flattery.

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
## COLLECTION CONTEXT

USER'S COLLECTION: ${collectionTypeInfo}
- Total unique cards: ${collectionSize?.toLocaleString() ?? cards.length}
${detectedFormat && detectedFormat !== 'Unknown' ? `- Detected format from export: ${detectedFormat}` : ''}
- Physical paper cards only. Recommendations for Commander, Modern, Pioneer, Standard, Legacy, and any format using physical cards.
## LANDS: Always assume unlimited access

The user has unlimited access to every land — basic and non-basic alike. Never flag any land as missing. Never list lands in a missing cards section. When building decks, choose whatever lands the mana base requires without checking the collection. Lands are excluded from "EVERY CARD THEY OWN" below for this reason.

When building from their collection, ONLY include non-land cards listed in "EVERY CARD THEY OWN" below. Cards not on that list must be flagged as "NOT IN COLLECTION."

EVERY CARD THEY OWN:
${cardList || '(no cards loaded)'}

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
═══════════════════════════════════════════`;

  const encoder = new TextEncoder();
  const incomingMessages: ChatMessage[] = (messages ?? []).slice(-20);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!process.env.GOOGLE_API_KEY) {
          throw new Error('GOOGLE_API_KEY environment variable is missing');
        }

        const contents = incomingMessages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + process.env.GOOGLE_API_KEY, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: system }]
            },
            contents,
            generationConfig: {
              maxOutputTokens: 4096
            }
          }),
        });

        const data = await res.json() as any;

        if (!res.ok) {
          const errMsg = data?.error?.message ?? `Gemini error ${res.status}`;
          console.error('Chat Gemini error:', errMsg);
          const isQuota = res.status === 429 || /quota|rate.?limit|exceeded/i.test(errMsg);
          throw new Error(isQuota
            ? 'Rate limit reached — please wait about a minute and try again.'
            : errMsg
          );
        }

        let fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        console.log(`Chat response: ${res.status}, length: ${fullResponse.length}`);

        if (!fullResponse) {
          console.error('Empty Gemini response:', JSON.stringify(data).slice(0, 500));
          throw new Error('Empty response from Gemini');
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
