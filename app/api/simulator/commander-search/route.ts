import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';

const USER_AGENT = 'MTGDeckBuilder/1.0 (+https://mtgdeckfinder.com)';

export interface CommanderOption {
  name: string;
  scryfallId: string;
  imageUrl: string | null;
  typeLine: string | null;
  manaCost: string | null;
  colorIdentity: string[];
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    // is:commander already handles partners, backgrounds, and commander-eligible
    // planeswalkers correctly — no need to reimplement that logic ourselves.
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`is:commander ${q}`)}&unique=cards&order=name`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      // Scryfall 404s a search with zero results — that's not an error for us
      if (res.status === 404) return NextResponse.json({ results: [] });
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    const results: CommanderOption[] = (data.data ?? []).slice(0, 8).map((card: any) => ({
      name: card.name,
      scryfallId: card.id,
      imageUrl: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
      typeLine: card.type_line ?? null,
      manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
      colorIdentity: card.color_identity ?? [],
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
