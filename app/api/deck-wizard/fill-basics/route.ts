import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';

const COLOR_TO_BASIC: Record<string, string> = {
  W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest',
};

const BASIC_LAND_NAMES = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest',
]);

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cards, deckSize, colorIdentity, minLands } = await req.json() as {
    cards: Array<{ name: string; quantity: number; colorPips?: Record<string, number> }>;
    deckSize: number;
    colorIdentity: string[];
    minLands?: number;
  };

  const currentCount = cards.reduce((s, c) => s + c.quantity, 0);
  const rawLandsNeeded = deckSize - currentCount;
  const landsNeeded = Math.max(rawLandsNeeded, minLands ?? 0);

  if (landsNeeded <= 0) {
    return NextResponse.json({ basics: {}, slotsAvailable: 0 });
  }

  // Determine which colors to use for basics.
  // Prefer explicit colorIdentity (commander format), but for non-commander decks it's often empty.
  // Fall back to inferring colors from the non-land card names via Scryfall.
  let colors = colorIdentity.filter(c => COLOR_TO_BASIC[c]);

  if (colors.length === 0) {
    // Ask Scryfall for the color identity of all non-land cards to determine what basics to add.
    const nonLandNames = cards
      .filter(c => !BASIC_LAND_NAMES.has(c.name))
      .map(c => c.name);

    if (nonLandNames.length > 0) {
      try {
        const CHUNK = 75;
        const colorCounts: Record<string, number> = {};

        for (let i = 0; i < nonLandNames.length; i += CHUNK) {
          const chunk = nonLandNames.slice(i, i + CHUNK);
          const res = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
            body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
          });
          if (!res.ok) continue;
          const data = await res.json() as { data: Array<{ mana_cost?: string; color_identity: string[] }> };
          for (const card of data.data) {
            for (const c of card.color_identity) {
              colorCounts[c] = (colorCounts[c] ?? 0) + 1;
            }
          }
        }

        // Use colors present on at least 10% of cards, or at least 1 card if deck is small
        const threshold = Math.max(1, Math.floor(nonLandNames.length * 0.1));
        colors = Object.entries(colorCounts)
          .filter(([c, count]) => count >= threshold && COLOR_TO_BASIC[c])
          .sort(([, a], [, b]) => b - a)
          .map(([c]) => c);

        console.log(`[fill-basics] inferred colors from ${nonLandNames.length} cards: ${colors.join('')} (counts: ${JSON.stringify(colorCounts)})`);
      } catch {
        // Scryfall unavailable — fall through to single-color default below
      }
    }
  }

  // Final fallback — truly colorless deck or Scryfall failed
  if (colors.length === 0) {
    return NextResponse.json({ basics: { Forest: landsNeeded }, slotsAvailable: landsNeeded });
  }

  // Distribute basics proportionally (even split for now — pip-weighting is a future enhancement)
  const total = colors.length;
  const basics: Record<string, number> = {};
  let remaining = landsNeeded;

  colors.forEach((color, i) => {
    const basicName = COLOR_TO_BASIC[color];
    if (!basicName) return;
    if (i === colors.length - 1) {
      basics[basicName] = remaining;
    } else {
      const share = Math.floor(landsNeeded / total);
      basics[basicName] = share;
      remaining -= share;
    }
  });

  return NextResponse.json({ basics, slotsAvailable: landsNeeded });
}
