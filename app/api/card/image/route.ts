import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const cardName = req.nextUrl.searchParams.get('name');
  if (!cardName) {
    return NextResponse.json({ error: 'Card name required' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.scryfall.com/cards/search?q="${encodeURIComponent(cardName)}"`);
    const data = await res.json();

    if (data.data && data.data.length > 0) {
      const card = data.data[0];
      const imageUrl = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || null;
      return NextResponse.json({ imageUrl });
    }

    return NextResponse.json({ imageUrl: null });
  } catch (err) {
    console.error(`Failed to fetch image for ${cardName}:`, err);
    return NextResponse.json({ imageUrl: null });
  }
}
