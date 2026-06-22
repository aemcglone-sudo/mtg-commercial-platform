/**
 * PATCH /api/collection/card  — add or update a card (quantity delta)
 * DELETE /api/collection/card — remove a card entirely
 * Body: { name: string, quantity?: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { getCards, cardPrice, cardImageUrl, ScryfallCard } from '@/lib/scryfall';

interface Row { id: string; parsedData: string; rawText: string }
interface CardEntry {
  name: string; quantity: number; priceUsd: number | null;
  imageUrl: string | null; scryfallUri: string | null; setName: string | null;
  collectionType?: 'paper' | 'arena';
}
interface ParsedData {
  collectionSize: number; totalCards: number; detectedFormat: string;
  collectionCards: CardEntry[];
}

async function getRow(userId: string): Promise<Row | null> {
  return findOne<Row>(
    `SELECT id, "parsedData", "rawText" FROM collection_uploads WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 1`,
    [userId]
  );
}

async function saveRow(id: string, data: ParsedData, rawText: string) {
  const cards = data.collectionCards;
  const updated: ParsedData = {
    collectionCards: cards,
    collectionSize: cards.length,
    totalCards: cards.reduce((s, c) => s + c.quantity, 0),
    detectedFormat: data.detectedFormat,
  };
  await run(
    `UPDATE collection_uploads SET "parsedData" = ?, "createdAt" = NOW() WHERE id = ?`,
    [JSON.stringify(updated), id]
  );
  return updated;
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, quantity = 1, collectionType = 'paper' } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const row = await getRow(userId);
  if (!row?.parsedData) return NextResponse.json({ error: 'No collection found' }, { status: 404 });

  const data: ParsedData = JSON.parse(row.parsedData);
  const cards = data.collectionCards;
  const existing = cards.find((c) => c.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    existing.quantity = Math.max(1, existing.quantity + quantity);
  } else {
    // Validate against Scryfall — try batch lookup first, fall back to fuzzy
    let card: ScryfallCard | null = null;
    const cardMap = await getCards([name]);
    card = cardMap.get(name) ?? null;

    if (!card) {
      // Batch lookup may miss new cards; try fuzzy search as fallback
      try {
        const fuzzyRes = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`,
          { headers: { 'User-Agent': 'MTGDeckBuilder/1.0' } }
        );
        if (fuzzyRes.ok) card = (await fuzzyRes.json()) as ScryfallCard;
      } catch { /* network error, card stays null */ }
    }

    if (!card) {
      return NextResponse.json({ error: `"${name}" not found on Scryfall` }, { status: 422 });
    }
    cards.push({
      name: card.name,
      quantity,
      priceUsd: cardPrice(card),
      imageUrl: cardImageUrl(card, 'small'),
      scryfallUri: card.scryfall_uri ?? null,
      setName: card.set_name ?? null,
      collectionType,
    });
    cards.sort((a, b) => a.name.localeCompare(b.name));
  }

  const updated = await saveRow(row.id, data, row.rawText);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const row = await getRow(userId);
  if (!row?.parsedData) return NextResponse.json({ error: 'No collection found' }, { status: 404 });

  const data: ParsedData = JSON.parse(row.parsedData);
  data.collectionCards = data.collectionCards.filter(
    (c) => c.name.toLowerCase() !== name.toLowerCase()
  );

  const updated = await saveRow(row.id, data, row.rawText);
  return NextResponse.json(updated);
}
