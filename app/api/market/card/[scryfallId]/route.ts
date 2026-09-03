import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCardsByIds, cardImageUrl } from '@/lib/scryfall';

export async function GET(req: NextRequest, { params }: { params: Promise<{ scryfallId: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scryfallId } = await params;
    const cards = await getCardsByIds([scryfallId]);
    const card = cards.get(scryfallId);
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

    return NextResponse.json({
      card: {
        scryfallId: card.id,
        name: card.name,
        setCode: card.set,
        setName: card.set_name,
        imageUrl: cardImageUrl(card) || null,
        priceUsd: card.prices.usd ? parseFloat(card.prices.usd) : null,
        priceFoilUsd: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null,
        rarity: card.rarity ?? null,
        scryfallUri: card.scryfall_uri,
      },
    });
  } catch (e) {
    console.error('GET /api/market/card/[scryfallId] failed:', e);
    return NextResponse.json({ error: 'Failed to load card' }, { status: 500 });
  }
}
