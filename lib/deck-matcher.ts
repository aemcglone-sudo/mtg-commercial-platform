import type { Collection } from './parse-collection';

export interface GapCard {
  name: string;
  needed: number;
  owned: number;
  shortage: number;
  priceUsd: number | null;
  isLand: boolean;  // true = specialty land, should be highlighted
}

export interface HaveCard {
  name: string;
  needed: number;
  owned: number;
  priceUsd: number | null;
  isLand: boolean;
}

export interface MatchedDeck {
  id: string;
  name: string;
  format: string;
  metaShare?: number;
  commanderName?: string;
  totalCards: number;
  ownedCards: number;
  coveragePct: number;
  missingCount: number;
  estimatedCost: number | null;
  gapCards: GapCard[];
  haveCards: HaveCard[];
  cards: Map<string, number>;
}

export interface DeckSource {
  id: string;
  name: string;
  format: string;
  metaShare?: number;
  commanderName?: string;
  cards: Map<string, number>;
}

// Basic lands that every player is assumed to have — auto-credited without
// needing them in the uploaded collection. Snow-covered variants included.
const FREE_LANDS = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest', 'Snow-Covered Wastes',
]);

// Any card whose Scryfall type_line contains "Land" is a land. We also fall
// back to a name-based heuristic for cards where we don't have type data.
const LAND_NAME_HINTS = /\b(land|fetch|strand|delta|flats|falls|passage|frontier|expanse|wilds|tower|grove|ruins|garden|caverns?|temple|guildgate|karoo|bounce\s*land)\b/i;

export function isLandCard(name: string, typeLine?: string): boolean {
  if (typeLine) return typeLine.includes('Land');
  return LAND_NAME_HINTS.test(name);
}

export function matchDeckToCollection(
  deck: DeckSource,
  collection: Collection,
  prices: Map<string, number> = new Map(),
  typeLines: Map<string, string> = new Map(),  // card name → type_line from Scryfall
): MatchedDeck {
  const gapCards: GapCard[] = [];
  const haveCards: HaveCard[] = [];
  let totalCards = 0;
  let ownedCards = 0;

  for (const [name, needed] of deck.cards) {
    // Free basic lands — assume every player has them
    if (FREE_LANDS.has(name)) {
      totalCards += needed;
      ownedCards += needed;
      continue;
    }

    totalCards += needed;
    const owned = collection.get(name) ?? 0;
    const filled = Math.min(owned, needed);
    ownedCards += filled;

    const priceUsd = prices.get(name) ?? null;
    const land = isLandCard(name, typeLines.get(name));

    if (filled > 0) {
      haveCards.push({ name, needed, owned, priceUsd, isLand: land });
    }

    if (filled < needed) {
      gapCards.push({ name, needed, owned, shortage: needed - filled, priceUsd, isLand: land });
    }
  }

  const coveragePct = totalCards > 0 ? (ownedCards / totalCards) * 100 : 0;
  const missingCount = gapCards.reduce((s, c) => s + c.shortage, 0);

  const estimatedCost =
    gapCards.every((c) => c.priceUsd !== null)
      ? gapCards.reduce((s, c) => s + c.shortage * (c.priceUsd ?? 0), 0)
      : null;

  // Sort: lands first (they're the most impactful missing pieces), then by price
  const sortGap = (a: GapCard, b: GapCard) => {
    if (a.isLand !== b.isLand) return a.isLand ? -1 : 1;
    return (b.priceUsd ?? 0) - (a.priceUsd ?? 0);
  };
  gapCards.sort(sortGap);
  haveCards.sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0));

  return {
    id: deck.id,
    name: deck.name,
    format: deck.format,
    metaShare: deck.metaShare,
    commanderName: deck.commanderName,
    totalCards,
    ownedCards,
    coveragePct,
    missingCount,
    estimatedCost,
    gapCards,
    haveCards,
    cards: deck.cards,
  };
}

export function rankDecks(decks: MatchedDeck[]): {
  buildable: MatchedDeck[];
  aspirational: MatchedDeck[];
} {
  const sorted = [...decks].sort((a, b) => b.coveragePct - a.coveragePct);
  return {
    buildable: sorted.filter((d) => d.coveragePct >= 70),
    aspirational: sorted.filter((d) => d.coveragePct < 70),
  };
}
