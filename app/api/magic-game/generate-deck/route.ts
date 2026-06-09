import { NextRequest, NextResponse } from 'next/server';
import { generateCommanderDeck } from '@/lib/magic-game/scryfall-integration';

export async function POST(req: NextRequest) {
  try {
    const { commanderName } = await req.json();

    if (!commanderName || typeof commanderName !== 'string') {
      return NextResponse.json({ error: 'Commander name required' }, { status: 400 });
    }

    const deck = await generateCommanderDeck(commanderName.trim());

    if (!deck || deck.length === 0) {
      return NextResponse.json({ error: 'Commander not found' }, { status: 404 });
    }

    return NextResponse.json({ deck });
  } catch (err) {
    console.error('Deck generation error:', err);
    return NextResponse.json({ error: 'Failed to generate deck' }, { status: 500 });
  }
}
