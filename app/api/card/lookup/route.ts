import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`,
      { headers: { 'User-Agent': 'Grimoire/1.0' } }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach Scryfall' }, { status: 502 });
  }
}
