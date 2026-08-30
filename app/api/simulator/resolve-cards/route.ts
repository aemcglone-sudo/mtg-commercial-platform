import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCards, cardImageUrl, cardPrice } from '@/lib/scryfall';

export interface ResolvedCard {
  name: string;
  cmc: number | null;
  colors: string[];
  typeLine: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  rarity: string | null;
  oracleText: string | null;
  scryfallUri: string | null;
  power: number | null;
  toughness: number | null;
}

function parsePT(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null; // non-numeric (e.g. "*") — treated as unknown
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { names } = await req.json() as { names?: string[] };
  if (!names || names.length === 0) return NextResponse.json({ cards: {} });

  const cardData = await getCards(names);

  const cards: Record<string, ResolvedCard> = {};
  for (const name of names) {
    const card = cardData.get(name);
    const colors = card?.colors ?? card?.card_faces?.[0]?.colors ?? [];
    cards[name.toLowerCase()] = {
      name: card?.name ?? name,
      cmc: card?.cmc ?? null,
      colors,
      typeLine: card?.type_line ?? null,
      imageUrl: card ? cardImageUrl(card, 'normal') : null,
      priceUsd: card ? cardPrice(card) : null,
      rarity: card?.rarity ?? null,
      oracleText: card?.oracle_text ?? null,
      scryfallUri: card?.scryfall_uri ?? null,
      power: parsePT(card?.power ?? card?.card_faces?.[0]?.power),
      toughness: parsePT(card?.toughness ?? card?.card_faces?.[0]?.toughness),
    };
  }

  return NextResponse.json({ cards, resolvedCount: cardData.size, requestedCount: names.length });
}
