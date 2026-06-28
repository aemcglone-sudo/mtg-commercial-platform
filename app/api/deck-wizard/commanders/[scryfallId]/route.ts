import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scryfallId: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scryfallId } = await params;

  // Fetch commander details from Scryfall (client-side in component, but proxied here)
  try {
    const scryfallRes = await fetch(`https://api.scryfall.com/cards/${scryfallId}`, {
      headers: { 'User-Agent': 'Grimoire/1.0' },
      next: { revalidate: 3600 },
    });

    if (!scryfallRes.ok) return NextResponse.json({ error: 'Commander not found' }, { status: 404 });
    const card = await scryfallRes.json() as {
      id: string; name: string; color_identity: string[]; oracle_text: string;
      image_uris?: { normal: string }; card_faces?: Array<{ image_uris?: { normal: string } }>;
      mana_cost?: string; cmc: number; type_line: string; prices: { usd?: string };
    };

    const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;

    return NextResponse.json({
      id: card.id,
      name: card.name,
      colorIdentity: card.color_identity,
      oracleText: card.oracle_text,
      imageUrl,
      manaCost: card.mana_cost,
      cmc: card.cmc,
      typeLine: card.type_line,
      priceUsd: card.prices.usd ? parseFloat(card.prices.usd) : null,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch commander data' }, { status: 502 });
  }
}
