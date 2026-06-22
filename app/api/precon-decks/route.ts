import { NextResponse } from 'next/server';

interface DeckEntry {
  fileName: string;
  name: string;
  releaseDate: string;
  type: string;
  code?: string;
}

let cachedDecks: DeckEntry[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  const now = Date.now();
  if (cachedDecks && now - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedDecks);
  }

  try {
    const res = await fetch('https://mtgjson.com/api/v5/DeckList.json', {
      headers: { 'User-Agent': 'Grimoire/1.0' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`MTGJson returned ${res.status}`);
    const data = await res.json();

    const commanderDecks: DeckEntry[] = (data.data ?? [])
      .filter((d: DeckEntry) => d.type === 'Commander Deck' && d.releaseDate >= '2022-01-01')
      .sort((a: DeckEntry, b: DeckEntry) => b.releaseDate.localeCompare(a.releaseDate))
      .slice(0, 80);

    cachedDecks = commanderDecks;
    cacheTime = now;

    return NextResponse.json(commanderDecks);
  } catch (err) {
    console.error('precon-decks index error:', err);
    return NextResponse.json({ error: 'Failed to fetch precon deck list' }, { status: 500 });
  }
}
