import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { parseCollection } from '@/lib/parse-collection';
import { parseCollectionWithClaude } from '@/lib/parse-with-claude';
import { fetchTopDecks } from '@/lib/mtgtop8';
import { fetchCommanderDeck, getPopularCommanders } from '@/lib/edhrec';
import { getCards, cardPrice } from '@/lib/scryfall';
import { matchDeckToCollection, rankDecks, type DeckSource } from '@/lib/deck-matcher';

const anthropic = new Anthropic();

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text: string = body.text ?? '';
  // Pre-parsed cards can be sent directly from the collection tab to skip re-parsing
  const preParseCards: Array<{ name: string; quantity: number }> | undefined = body.cards;

  if (!text.trim() && !preParseCards?.length) {
    return NextResponse.json({ error: 'Empty collection' }, { status: 400 });
  }

  // Build collection map — prefer pre-parsed data, then Claude, then regex
  let collection: Map<string, number>;
  if (preParseCards?.length) {
    collection = new Map(preParseCards.map(({ name, quantity }) => [name, quantity]));
  } else {
    collection = parseCollection(text);
    if (collection.size === 0) {
      try {
        const result = await parseCollectionWithClaude(text);
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

  // Collect deck card names for price lookup
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
        cards: d.cards,
      })),
  ];

  const matched = deckSources.map((d) => {
    const m = matchDeckToCollection(d, collection, prices, typeLines);
    const { cards: _cards, ...rest } = m;
    return rest;
  });

  const { buildable, aspirational } = rankDecks(matched.map((m) => ({ ...m, cards: new Map() })));

  // Generate AI-suggested custom decks based on collection
  let suggested: any[] = [];
  try {
    const cardList = Array.from(collection.entries())
      .map(([name, qty]) => {
        const type = typeLines.get(name) || '';
        return `${qty}x ${name}${type ? ` (${type})` : ''}`;
      })
      .sort()
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are an expert Magic: The Gathering deck builder. Analyze this collection and suggest 2-3 creative deck ideas that leverage the cards they own.

COLLECTION (${collection.size} unique cards, ${Array.from(collection.values()).reduce((a, b) => a + b, 0)} total):
${cardList}

For each deck idea:
1. Identify a clear strategy/theme from their cards (e.g., "Sultai Control", "Mono-Red Burn", "Orzhov Lifegain")
2. List 60 cards for a complete deck, heavily favoring cards from their collection
3. Try to reach ~70%+ coverage with their owned cards
4. Include basic lands (estimate what they need)
5. Format as: DECK NAME | STRATEGY
   Then list each card as: QTY CARDNAME

Keep decks practical and focused. Prioritize synergy over completing meta archetypes.
Return only the deck lists, no explanation.`,
        },
      ],
    });

    const text = response.content.find(b => b.type === 'text')?.text ?? '';
    const suggestedDecks = parseDeckSuggestions(text);

    suggested = suggestedDecks
      .map((deck, idx) =>
        matchDeckToCollection(
          {
            id: `custom-${idx}`,
            name: deck.name,
            format: 'Custom',
            cards: deck.cards,
          },
          collection,
          prices,
          typeLines
        )
      )
      .sort((a, b) => b.coveragePct - a.coveragePct)
      .map(m => {
        const { cards: _cards, ...rest } = m;
        return rest;
      });
  } catch (err) {
    console.error('Failed to generate suggestions:', err);
    // Continue without suggestions if Claude fails
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
        if (qty > 0 && cardName) {
          cards.set(cardName, qty);
        }
      }
    }

    if (cards.size > 0) {
      decks.push({ name: deckName, cards });
    }
  }

  return decks;
}
