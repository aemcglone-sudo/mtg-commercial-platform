import { NextRequest, NextResponse } from 'next/server';
import { getCards } from '@/lib/scryfall';

export async function POST(req: NextRequest) {
  const { cards } = await req.json();

  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json({ error: 'No cards provided' }, { status: 400 });
  }

  try {
    // Get card data from Scryfall to find TCGPlayer IDs
    const cardNames = cards.map(([name]) => name);
    const cardData = await getCards(cardNames);

    // Build TCGPlayer cart items
    const cartItems: Array<{ productId: string; quantity: number }> = [];

    for (const [cardName, quantity] of cards) {
      const card = cardData.get(cardName);
      if (card?.tcgplayer_id) {
        cartItems.push({
          productId: String(card.tcgplayer_id),
          quantity,
        });
      }
    }

    if (cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Could not find TCGPlayer IDs for any cards' },
        { status: 400 }
      );
    }

    // Generate TCGPlayer cart URL
    // Format: https://www.tcgplayer.com/cart/add/[id1]/[qty1]/[id2]/[qty2]/...
    const cartUrl = `https://www.tcgplayer.com/cart/add/${cartItems
      .map(item => `${item.productId}/${item.quantity}`)
      .join('/')}`;

    return NextResponse.json({ cartUrl });
  } catch (err) {
    console.error('Failed to generate TCGPlayer cart URL:', err);
    return NextResponse.json(
      { error: 'Failed to generate cart link' },
      { status: 500 }
    );
  }
}
