import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';

const COLOR_TO_BASIC: Record<string, string> = {
  W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest',
};

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cards, deckSize, colorIdentity } = await req.json() as {
    cards: Array<{ name: string; quantity: number; colorPips?: Record<string, number> }>;
    deckSize: number;
    colorIdentity: string[];
  };

  const currentCount = cards.reduce((s, c) => s + c.quantity, 0);
  const rawLandsNeeded = deckSize - currentCount;
  // Never exceed a sensible max land count — if suggestions were short, don't dump 70+ basics.
  const maxBasics = deckSize === 100 ? 40 : 26;
  const landsNeeded = Math.min(rawLandsNeeded, maxBasics);

  if (landsNeeded <= 0) {
    return NextResponse.json({ basics: {}, slotsAvailable: 0 });
  }

  if (colorIdentity.length === 0) {
    return NextResponse.json({ basics: { Forest: landsNeeded }, slotsAvailable: landsNeeded });
  }

  // Count color pips from existing non-land cards to determine ratio
  const pipCounts: Record<string, number> = {};
  for (const color of colorIdentity) {
    pipCounts[color] = 0;
  }

  // Simple even split if no pip data available
  const total = colorIdentity.length;
  const basics: Record<string, number> = {};
  let remaining = landsNeeded;

  colorIdentity.forEach((color, i) => {
    const basicName = COLOR_TO_BASIC[color];
    if (!basicName) return;
    if (i === colorIdentity.length - 1) {
      basics[basicName] = remaining;
    } else {
      const share = Math.floor(landsNeeded / total);
      basics[basicName] = share;
      remaining -= share;
    }
  });

  return NextResponse.json({ basics, slotsAvailable: landsNeeded });
}
