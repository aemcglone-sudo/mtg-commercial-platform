import { NextRequest, NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { findMany, findOne } from '@/lib/db';

export interface DeckLogEntry {
  id: string;
  userId: string;
  userEmail: string | null;
  name: string;
  format: string | null;
  strategy: string | null;
  commander: string | null;
  cards: string; // JSON
  rubric_score: string | null; // JSON
  rubric_scored_at: string | null;
  createdAt: string;
}

export interface DeckLogCard {
  name: string;
  quantity: number;
  cmc?: number;
  type_line?: string;
  mana_cost?: string;
  image_uris?: { normal?: string; small?: string };
  scryfall_uri?: string;
}

export async function GET(req: NextRequest) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const deckId = searchParams.get('deckId');

  // Single deck detail with Scryfall card data
  if (deckId) {
    const deck = await findOne<DeckLogEntry>(
      `SELECT d.id, d."userId", u.email as "userEmail", d.name, d.format, d.strategy,
              d.commander, d.cards, d.rubric_score, d.rubric_scored_at, d."createdAt"
       FROM decks d
       LEFT JOIN users u ON u.id = d."userId"
       WHERE d.id = ?`,
      [deckId]
    );
    if (!deck) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fetch Scryfall data for all cards
    const cardsObj: Record<string, number> = deck.cards ? JSON.parse(deck.cards) : {};
    const cardNames = Object.keys(cardsObj);
    const scryfallCards: DeckLogCard[] = [];

    const CHUNK = 75;
    for (let i = 0; i < cardNames.length; i += CHUNK) {
      const chunk = cardNames.slice(i, i + CHUNK);
      try {
        const res = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
          body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
        });
        if (res.ok) {
          const data = await res.json() as { data: Array<{ name: string; cmc: number; type_line: string; mana_cost?: string; image_uris?: { normal?: string; small?: string }; scryfall_uri?: string }> };
          for (const card of data.data) {
            scryfallCards.push({
              name: card.name,
              quantity: cardsObj[card.name] ?? 1,
              cmc: card.cmc,
              type_line: card.type_line,
              mana_cost: card.mana_cost,
              image_uris: card.image_uris,
              scryfall_uri: card.scryfall_uri,
            });
          }
        }
      } catch { /* best effort */ }
      if (i + CHUNK < cardNames.length) await new Promise(r => setTimeout(r, 100));
    }

    // Add any cards not found in Scryfall
    const foundNames = new Set(scryfallCards.map(c => c.name.toLowerCase()));
    for (const name of cardNames) {
      if (!foundNames.has(name.toLowerCase())) {
        scryfallCards.push({ name, quantity: cardsObj[name] ?? 1 });
      }
    }

    return NextResponse.json({ deck, cards: scryfallCards });
  }

  // List all decks
  const decks = await findMany<DeckLogEntry>(
    `SELECT d.id, d."userId", u.email as "userEmail", d.name, d.format, d.strategy,
            d.commander, d.rubric_score, d.rubric_scored_at, d."createdAt"
     FROM decks d
     LEFT JOIN users u ON u.id = d."userId"
     ORDER BY d."createdAt" DESC
     LIMIT 200`
  );

  return NextResponse.json({ decks });
}
