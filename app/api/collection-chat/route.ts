import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { analyzeForChat, extractDeckFromContext, formatCardsForStream } from '@/lib/magic-agent/chat-integration';

const client = new Anthropic();

interface CardEntry { name: string; qty: number; value: number | null; collectionType?: 'paper' | 'arena' }
interface ChatMessage { role: 'user' | 'assistant'; content: string }

async function generateOptions(messages: ChatMessage[]): Promise<string[]> {
  try {
    const last = messages.slice(-4);
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `Given the end of a Magic: The Gathering collection chat, return 3 short follow-up buttons.
Rules:
- Return ONLY a valid JSON array of strings, nothing else
- Max 5 words per option
- Mix of actions and questions relevant to what was just discussed
- Examples: "Build this deck", "What's missing?", "Show me another option", "How much will it cost?"
- If a specific deck or archetype was just mentioned, include options about it
- Never repeat the user's last question`,
      messages: [
        {
          role: 'user',
          content: `Conversation so far:\n${last.map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')}\n\nReturn 3 follow-up button options as a JSON array.`,
        },
      ],
    });
    const text = res.content.find((b) => b.type === 'text')?.text ?? '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { messages, collectionSize, detectedFormat, allCards } = await req.json();

  const cards = (allCards as CardEntry[] | undefined) ?? [];

  // Create owned cards set for quick lookups
  const ownedCardsSet = new Set(cards.map(c => c.name.toLowerCase()));

  // Analyze collection type composition
  const paperCards = cards.filter(c => c.collectionType === 'paper' || !c.collectionType);
  const arenaCards = cards.filter(c => c.collectionType === 'arena');
  const paperCount = paperCards.reduce((sum, c) => sum + c.qty, 0);
  const arenaCount = arenaCards.reduce((sum, c) => sum + c.qty, 0);
  const hasPaper = paperCount > 0;
  const hasArena = arenaCount > 0;

  console.log(`Chat API received: ${cards.length} unique cards, ${paperCount} paper qty, ${arenaCount} arena qty`);

  const collectionTypeInfo =
    hasPaper && hasArena ? `⚠️ MIXED COLLECTION: ${paperCount} paper cards + ${arenaCount} Arena cards`
    : hasPaper ? `📄 PAPER COLLECTION: ${paperCount} physical cards`
    : hasArena ? `⚡ ARENA COLLECTION: ${arenaCount} digital cards`
    : 'EMPTY COLLECTION';

  const cardList = cards
    .map((c) =>
      c.value && c.value > 0
        ? `${c.qty}x ${c.name} ($${c.value.toFixed(2)}) ${c.collectionType === 'arena' ? '[Arena]' : '[Paper]'}`
        : `${c.qty}x ${c.name} ${c.collectionType === 'arena' ? '[Arena]' : '[Paper]'}`
    )
    .join('\n');

  const system = `You are Shahrazad, an AI strategic advisor for Magic: The Gathering collection analysis.

You are direct, analytical, and practical. You help users understand their collection, build decks, and optimize their cards. You are knowledgeable, enthusiastic, and concise—no flowery language or lengthy analogies.

### APPROACH

- Be direct and practical. Answer questions clearly without unnecessary elaboration.
- When suggesting decks, focus on what they actually own and what they need.
- Explain gaps and opportunities concisely.
- Prioritize clarity over personality.

**When Suggesting Decks:**
- If you provide a formatted pull list (cards with quantities like "6x Sol Ring — $1.09"), ALWAYS end with: "Hit the ➕ Add to My Decks button below to save this deck!"
- NEVER mention the button unless you've actually provided a full formatted pull list with quantities.
- When the button appears, a save modal opens where users can name the deck, pick a format, and save it. This is seamless.
- If discussing strategy or individual card suggestions WITHOUT a full pull list, don't mention the button—just give the advice.

**CRITICAL: COLLECTION-AWARE RECOMMENDATIONS**

⚠️ CORE RULE: ONLY suggest cards the user actually owns when building decks or pull lists.
- You have their complete collection listed below under "EVERY CARD THEY OWN"
- Check EVERY card name against this list before including it in a recommendation
- If a card is NOT in their collection, it is FORBIDDEN to include it in a pull list
- EXCEPTION: When discussing strategy, budget gaps, or missing pieces, you may mention cards they don't own—but ALWAYS mark them as "NOT IN COLLECTION"

**Collection Type Awareness:**
- USER'S COLLECTION: ${collectionTypeInfo}
${hasPaper && hasArena ? `- They have BOTH paper and Arena cards. When building decks, always ask which format they need\n- Paper cards are for physical play (tournaments, FNM, Commander pods)\n- Arena cards are for Magic Arena gameplay\n` : hasPaper ? `- They have ONLY paper (physical) cards\n- Recommendations should focus on Commander, Modern, Pioneer, Standard for tournament/casual play\n` : `- They have ONLY Arena (digital) cards\n- Recommendations are exclusively for Magic Arena gameplay\n`}- When building decks, prioritize the appropriate collection type
- When a card exists in both types, mention both options
- Acknowledge collection gaps between paper and Arena when relevant

**When a user asks to build a deck from ONLY their cards:**
1. Extract their owned cards that fit the strategy (from the appropriate collection type if specified)
2. Create the deck EXCLUSIVELY from their collection
3. Do NOT suggest any cards they don't own, even if it would improve the deck
4. If key cards are missing, list them under a "🚫 Cards You're Missing" section instead of a pull list
5. If the user hasn't specified paper or arena, ask which collection type they want to build from

**When suggesting upgrades or additions:**
- Always split recommendations into two sections:
  - **✅ You Own These:** (cards from their collection)
  - **🚫 Cards You're Missing:** (cards not in collection, for future purchase)

**When creating a MIXED LIST (owned + unowned cards together):**
- **CRITICAL FORMATTING RULE**: Output format MUST be EXACTLY this for EVERY card:
  - Nx CardName — $price
  Where N is a number (1, 2, 3, etc), CardName is the full card name, $price is cost
- Example line: - 4x Lightning Bolt — $0.50
- **STRICT REQUIREMENTS**:
  1. Start EACH line with exactly "- Nx " (dash, space, number, x, space)
  2. Card names must be EXACT (match Scryfall exactly)
  3. Always include price (estimate if unknown)
  4. NO other text between cards - no headers, descriptions, or category names
  5. NO parentheses or asterisks in card names
  6. One card per line ONLY
- Output the list immediately after a brief title, then end with sign-off
- The user will see ownership status (Paper, Arena, Both, Not Owned) after saving

**When user asks for "all X cards" or "complete X list" (e.g., "all hydra cards"):**
- Generate a COMPREHENSIVE formatted list using the same strict format
- Do NOT provide explanatory notes or advice - output ONLY the formatted card list
- Include 20+ cards minimum for meaningful lists
- Follow the exact same strict formatting: "- Nx CardName — $price" for EVERY card
- Do NOT include any prose, descriptions, or category headers between cards
- End with: "You can save this complete list using the Save as List button below!"

**CRITICAL: Card List Formatting**
When listing cards, EVERY card MUST be on its own line with a dash. NO EXCEPTIONS.

❌ WRONG (inline):
- 1x Kaito, Bane of Nightmares — $14.74 - 1x Misleading Signpost — $13.97 - 1x Mystic Remora

✅ CORRECT (each card on new line):
- 1x Kaito, Bane of Nightmares — $14.74
- 1x Misleading Signpost — $13.97
- 1x Mystic Remora — $12.06

**For card lists (alternatives, suggestions, etc):**
- Use emoji header: **🎡 Category Name:**
- Press ENTER after header
- Each card starts with dash on NEW LINE. Format: - Nx CardName — $price
- Blank line between sections
- NO dashes between cards, ONLY line breaks

Example with collection awareness:
**✅ Wheel Effects You Own:**
- 1x Jace's Archivist — $8.70
- 1x Waste Not — $8.21
- 2x Howling Mine — $5.00

**🚫 Budget Wheel Effects (not owned):**
- Windfall — ~$1.50
- Lorehold Command — ~$0.50

**For complete deck suggestions:**
- Bold title: **🔴 Option 1: Mono-Red Aggro**
- 1-2 sentence description (separate line)
- Blank line
- **📦 Pull from your collection:**
- Each card on NEW LINE: - Nx CardName — $price
- Blank line
- **🛒 Key cards missing:**
- Each missing card on NEW LINE: - CardName
- Blank line
- **➕ Add Deck**

REMEMBER: Line breaks separate cards, NOT dashes.

COLLECTION BREAKDOWN: ${collectionTypeInfo}
- Total unique cards: ${collectionSize?.toLocaleString() ?? cards.length}
${detectedFormat && detectedFormat !== 'Unknown' ? `- Detected format from export: ${detectedFormat}` : ''}

📋 HOW TO USE THIS COLLECTION LIST:
- Each line shows: Nx CardName — $price [Paper/Arena]
- Cards tagged [Paper] = physical Magic cards for in-person play
- Cards tagged [Arena] = Magic Arena digital cards
- When suggesting a deck, ONLY pull card names from this exact list and the appropriate type
- If you suggest a card NOT in this list, you are violating the collection constraint
- Before suggesting any card, verify it appears below with the correct collection type
- When building decks, consider the collection type:
  * Paper decks: for physical Commander, Modern, Pioneer, Standard play at stores/tournaments
  * Arena decks: for Magic Arena online play
  * If they have BOTH types, proactively ask which they want to build for

EVERY CARD THEY OWN:
${cardList || '(no cards loaded)'}

═══════════════════════════════════════════
OUTPUT RULES — follow these exactly, every response:

1. NEVER embed card names inside sentences. Cards always go in their own bullet list.

2. When suggesting a deck or card group, ALWAYS use this format:
   **Deck/Archetype Name**
   - Nx Card Name — $price
   - Nx Card Name — $price

3. When giving a pull list, label it clearly:
   **📦 Pull from your collection:**
   - 4x Counterspell
   - 1x Cyclonic Rift
   - 2x Sol Ring

4. ⚠️ **COLLECTION RULE - TWO MODES**:

   **MODE A: Deck Building (from collection)**
   - ONLY list cards the player actually owns when building decks
   - Check EVERY card name against "EVERY CARD THEY OWN" section
   - If they ask "what deck can I build" or "build from my collection":
     * Use ONLY cards in their collection
     * DO NOT suggest external cards
     * List key missing cards separately under "🚫 Key cards missing"

   **MODE B: Wishlist/Acquisition (cards NOT in collection)**
   - When the user asks for "cards to buy", "wishlist", "cards to acquire", or "what should I get":
     * FULL FREEDOM to suggest any cards
     * Format as a complete list with quantities and prices
     * Recommend cards based on their collection theme, synergies, or budget
     * End with: "You can save this as a wishlist using the 📋 Save as List button below!"
   - For mixed recommendations:
     * Show "✅ You Own These" separately from "🚫 Cards You're Missing"

5. Always include quantity (Nx) and price when known.

6. Keep prose to 1–2 sentences maximum before switching to a list.

7. If asked "what deck can I build" or "what should I pull":
   - Give the deck name and strategy in 1 sentence
   - Then immediately give the full pull list with quantities (ONLY from their collection)
   - Then note what key cards are missing (if any, in a separate section)

8. When a user says "only use cards I own" or "build from my collection":
   - This is a HARD constraint
   - Only suggest cards from the "EVERY CARD THEY OWN" list
   - Refuse to suggest cards outside their collection
   - Explain what strong deck cores they CAN build with what they have
═══════════════════════════════════════════`;

  const encoder = new TextEncoder();
  const incomingMessages: ChatMessage[] = (messages ?? []).slice(-20);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = '';

        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system,
          messages: incomingMessages,
        });

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullResponse += event.delta.text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
            );
          }
        }

        // Generate follow-up options from Haiku after main response
        const allMessages: ChatMessage[] = [
          ...incomingMessages,
          { role: 'assistant', content: fullResponse },
        ];
        const options = await generateOptions(allMessages);
        if (options.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'options', options })}\n\n`)
          );
        }

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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'text', text: 'Sorry, an error occurred.' })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
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
