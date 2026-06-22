import { NextRequest, NextResponse } from 'next/server';
import { matchDeckToCollection, type DeckSource, type MatchedDeck } from '@/lib/deck-matcher';
import { getCards, cardPrice } from '@/lib/scryfall';

export const maxDuration = 60;

interface CollectionCard {
  name: string;
  qty: number;
  typeLine?: string;
  colors?: string[];
}

async function generateDeckList(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cards: CollectionCard[] = body.cards ?? [];
  const collection = new Map(cards.map(c => [c.name, c.qty]));

  if (cards.length === 0) {
    return NextResponse.json({ error: 'Empty collection' }, { status: 400 });
  }

  const cardData = await getCards(cards.map(c => c.name));
  const typeLines = new Map<string, string>();
  const colors = new Map<string, string[]>();
  const prices = new Map<string, number>();

  for (const [name, card] of cardData) {
    if (card.type_line) typeLines.set(name, card.type_line);
    if (card.colors) colors.set(name, card.colors);
    const p = cardPrice(card);
    if (p > 0) prices.set(name, p);
  }

  const cardList = cards
    .map(c => {
      const type = typeLines.get(c.name) || '';
      const color = colors.get(c.name)?.join('') || '';
      return `${c.qty}x ${c.name} (${type}${color ? ' - ' + color : ''})`;
    })
    .sort()
    .join('\n');

  const prompt = `You are an expert Magic: The Gathering deck builder. Analyze this collection and suggest 2-3 creative deck ideas that leverage the cards the player owns.

COLLECTION (${cards.length} cards, ${cards.reduce((s, c) => s + c.qty, 0)} total):
${cardList}

For each deck idea:
1. Identify a clear strategy/theme from their cards (e.g., "Sultai Control", "Mono-Red Burn", "Orzhov Lifegain")
2. List 60 cards for a complete deck, heavily favoring cards from their collection
3. Try to reach ~70%+ coverage with their owned cards
4. Include basic lands (estimate what they need)
5. Format as: DECK NAME | STRATEGY
   Then list each card as: QTY CARDNAME

Keep decks practical and focused. Prioritize synergy over completing meta archetypes.
Return only the deck lists, no explanation.`;

  try {
    const text = await generateDeckList(prompt);
    const decks = parseDeckSuggestions(text);

    const matched = decks
      .map((deck, idx) =>
        matchDeckToCollection(
          { id: `custom-${idx}`, name: deck.name, format: 'Custom', cards: deck.cards },
          collection, prices, typeLines
        )
      )
      .sort((a, b) => b.coveragePct - a.coveragePct);

    return NextResponse.json({ suggested: matched });
  } catch (err) {
    console.error('Deck suggestion error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to suggest decks' },
      { status: 500 }
    );
  }
}

interface DeckSuggestion {
  name: string;
  cards: Map<string, number>;
}

function parseDeckSuggestions(text: string): DeckSuggestion[] {
  const decks: DeckSuggestion[] = [];
  const sections = text.split(/\n(?=[A-Z].*\|)/);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    if (lines.length < 2) continue;

    const headerMatch = lines[0].match(/^([^|]+)\s*\|\s*(.+)$/);
    if (!headerMatch) continue;

    const deckName = `${headerMatch[1].trim()} (${headerMatch[2].trim()})`;
    const cards = new Map<string, number>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const match = line.match(/^(\d+)x?\s+(.+?)(?:\s*\(|$)/);
      if (match) {
        const qty = parseInt(match[1], 10);
        const cardName = match[2].trim();
        if (qty > 0 && cardName) cards.set(cardName, qty);
      }
    }

    if (cards.size > 0) decks.push({ name: deckName, cards });
  }

  return decks;
}
