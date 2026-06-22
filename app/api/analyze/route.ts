import { NextRequest, NextResponse } from 'next/server';
import { parseCollection } from '@/lib/parse-collection';
import { parseCollectionWithGemini } from '@/lib/parse-with-gemini';
import { fetchTopDecks } from '@/lib/mtgtop8';
import { fetchCommanderDeck, getPopularCommanders } from '@/lib/edhrec';
import { getCards, cardPrice } from '@/lib/scryfall';
import { matchDeckToCollection, rankDecks, type DeckSource } from '@/lib/deck-matcher';

export const maxDuration = 60;

async function generateDeckSuggestions(cardList: string, collectionSize: number, totalCards: number): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are an expert Magic: The Gathering deck builder. Return only deck lists in the exact format requested — no explanations.' }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: `Analyze this collection and suggest 2-3 creative deck ideas that leverage the cards the player owns.

COLLECTION (${collectionSize} unique cards, ${totalCards} total):
${cardList}

For each deck idea:
1. Identify a clear strategy/theme from their cards (e.g., "Sultai Control", "Mono-Red Burn", "Orzhov Lifegain")
2. List 60 cards for a complete deck, heavily favoring cards from their collection
3. Try to reach ~70%+ coverage with their owned cards
4. Include basic lands (estimate what they need)
5. Format as: DECK NAME | STRATEGY
   Then list each card as: QTY CARDNAME

Keep decks practical and focused. Prioritize synergy over completing meta archetypes.
Return only the deck lists, no explanation.` }]
        }],
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
  const text: string = body.text ?? '';
  const preParseCards: Array<{ name: string; quantity: number }> | undefined = body.cards;

  if (!text.trim() && !preParseCards?.length) {
    return NextResponse.json({ error: 'Empty collection' }, { status: 400 });
  }

  let collection: Map<string, number>;
  if (preParseCards?.length) {
    collection = new Map(preParseCards.map(({ name, quantity }) => [name, quantity]));
  } else {
    collection = parseCollection(text);
    if (collection.size === 0) {
      try {
        const result = await parseCollectionWithGemini(text);
        collection = result.collection;
      } catch { /* fall through */ }
    }
  }

  if (collection.size === 0) {
    return NextResponse.json({ error: 'Could not parse any cards from the file' }, { status: 400 });
  }

  const commanders = getPopularCommanders();
  const [standardDecks, pioneerDecks, commanderDecks] = await Promise.all([
    fetchTopDecks('Standard', 35),
    fetchTopDecks('Pioneer', 35),
    Promise.all(commanders.slice(0, 25).map((c) => fetchCommanderDeck(c.slug, c.name))),
  ]);

  const deckCardNames = new Set<string>();
  for (const d of [...standardDecks, ...pioneerDecks]) {
    for (const name of d.cards.keys()) deckCardNames.add(name);
  }
  for (const d of commanderDecks) {
    if (d) for (const name of d.cards.keys()) deckCardNames.add(name);
  }

  const cardData = await getCards([...deckCardNames]);
  const prices = new Map<string, number>();
  const typeLines = new Map<string, string>();
  for (const [name, card] of cardData) {
    const p = cardPrice(card);
    if (p > 0) prices.set(name, p);
    if (card.type_line) typeLines.set(name, card.type_line);
  }

  const deckSources: DeckSource[] = [
    ...standardDecks.map((d) => ({ id: d.id, name: d.name, format: 'Standard', cards: d.cards })),
    ...pioneerDecks.map((d) => ({ id: d.id, name: d.name, format: 'Pioneer', cards: d.cards })),
    ...commanderDecks
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((d) => ({
        id: `edh-${d.commanderSlug}`,
        name: `${d.commanderName} Commander`,
        format: 'Commander',
        commanderName: d.commanderName,
        strategy: commanders.find(c => c.slug === d.commanderSlug)?.strategy,
        cards: d.cards,
      })),
  ];

  const matched = deckSources.map((d) => {
    const m = matchDeckToCollection(d, collection, prices, typeLines);
    const { cards: _cards, ...rest } = m;
    return rest;
  });

  const { buildable, aspirational } = rankDecks(matched.map((m) => ({ ...m, cards: new Map() })));

  let suggested: any[] = [];
  try {
    const cardList = Array.from(collection.entries())
      .map(([name, qty]) => {
        const type = typeLines.get(name) || '';
        return `${qty}x ${name}${type ? ` (${type})` : ''}`;
      })
      .sort()
      .join('\n');

    const responseText = await generateDeckSuggestions(cardList, collection.size, Array.from(collection.values()).reduce((a, b) => a + b, 0));
    const suggestedDecks = parseDeckSuggestions(responseText);

    suggested = suggestedDecks
      .map((deck, idx) =>
        matchDeckToCollection(
          { id: `custom-${idx}`, name: deck.name, format: 'Custom', cards: deck.cards },
          collection, prices, typeLines
        )
      )
      .sort((a, b) => b.coveragePct - a.coveragePct)
      .map(m => {
        const { cards: _cards, ...rest } = m;
        return rest;
      });
  } catch (err) {
    console.error('Failed to generate suggestions:', err);
  }

  return NextResponse.json({ buildable, aspirational, suggested });
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
