import { NextRequest, NextResponse } from 'next/server';

interface DeckCard {
  name: string;
  count: number;
}

interface DeckResult {
  name: string;
  code: string;
  releaseDate: string;
  commander: string | null;
  cards: DeckCard[];
}

const deckCache = new Map<string, DeckResult>();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const { fileName } = await params;

  // Sanitize — only allow alphanumeric + underscore
  if (!/^[A-Za-z0-9_]+$/.test(fileName)) {
    return NextResponse.json({ error: 'Invalid fileName' }, { status: 400 });
  }

  if (deckCache.has(fileName)) {
    return NextResponse.json(deckCache.get(fileName));
  }

  try {
    const res = await fetch(`https://mtgjson.com/api/v5/decks/${fileName}.json`, {
      headers: { 'User-Agent': 'Grimoire/1.0' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`MTGJson returned ${res.status}`);
    const data = await res.json();
    const deck = data.data;

    const cards: DeckCard[] = [
      ...(deck.commander ?? []),
      ...(deck.mainBoard ?? []),
    ].map((c: any) => ({ name: c.name, count: c.count ?? 1 }));

    const result: DeckResult = {
      name: deck.name,
      code: deck.code ?? '',
      releaseDate: deck.releaseDate ?? '',
      commander: deck.commander?.[0]?.name ?? null,
      cards,
    };

    deckCache.set(fileName, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`precon-decks [${fileName}] error:`, err);
    return NextResponse.json({ error: 'Failed to fetch deck' }, { status: 500 });
  }
}
