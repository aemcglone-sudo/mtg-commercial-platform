import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  const scryfallId = searchParams.get('scryfallId');

  if (!name && !scryfallId) return NextResponse.json({ error: 'name or scryfallId required' }, { status: 400 });

  // If we know the exact printing (e.g. from a collection import that captured
  // a Scryfall ID), fetch it directly — a name-only lookup can land on a
  // different printing with a very different price/image for the same card name.
  const url = scryfallId
    ? `https://api.scryfall.com/cards/${encodeURIComponent(scryfallId)}`
    : `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name!)}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Grimoire/1.0' } });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach Scryfall' }, { status: 502 });
  }
}
