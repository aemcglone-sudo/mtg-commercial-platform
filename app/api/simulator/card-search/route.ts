import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';

const USER_AGENT = 'MTGDeckBuilder/1.0 (+https://mtgdeckfinder.com)';

export interface CardSearchOption {
  name: string;
  scryfallId: string;
  imageUrl: string | null;
  typeLine: string | null;
}

// General card-name search, used for adding an opponent's permanents to the
// game table so their board can show real card art/type (unlike the plain
// text this used to be) — no is:commander restriction like commander-search.
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=name`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const results: CardSearchOption[] = (data.data ?? []).slice(0, 8).map((card: any) => ({
      name: card.name,
      scryfallId: card.id,
      imageUrl: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
      typeLine: card.type_line ?? null,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
