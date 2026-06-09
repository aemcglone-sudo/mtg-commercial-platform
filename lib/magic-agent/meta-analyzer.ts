/**
 * Magic Agent - Meta Analyzer
 *
 * Fetches current tournament meta from Top 8 and MTG Goldfish.
 * Analyzes user decks against the meta, detects format trends.
 * Caches results for 4 hours (meta shifts gradually).
 */

import { fetchTopDecks as fetchTop8Decks } from '@/lib/mtgtop8';
import { fetchTopDecks as fetchGoldfishDecks } from '@/lib/mtggoldfish';
import { getCards } from '@/lib/scryfall';
import { getCachedData, setCachedData, isDataStale, JOB_THRESHOLDS } from './job-runner';
import type { MetaData, Archetype, DeckAnalysis } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Internal meta snapshot with raw deck data
 */
interface MetaSnapshot {
  format: string;
  source: 'top8' | 'goldfish' | 'combined';
  archetypes: {
    name: string;
    metaShare: number;
    winRate: number | null;
    keyCards: string[];
    colors: string[];
  }[];
  snapshotDate: Date;
}

/**
 * Deck analysis against meta
 */
export interface DeckMetaScore {
  deckId: string;
  deckName: string;
  format: string;
  metaScore: number; // 0-100
  archetypeMatch: {
    archetype: string;
    similarity: number; // 0-1
    matchedCards: number;
    keyCardsInDeck: number;
  } | null;
  comments: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Meta shift significance thresholds
 */
const META_SHIFT_THRESHOLDS = {
  MINOR: 2, // 2% meta share change
  MODERATE: 3, // 3% change
  MAJOR: 5, // 5% change
} as const;

/**
 * Default archetype color combinations for identification
 */
const ARCHETYPE_COLORS: Record<string, string[]> = {
  'Izzet': ['U', 'R'],
  'Dimir': ['U', 'B'],
  'Rakdos': ['R', 'B'],
  'Gruul': ['G', 'R'],
  'Selesnya': ['W', 'G'],
  'Azorius': ['W', 'U'],
  'Orzhov': ['W', 'B'],
  'Grixis': ['U', 'R', 'B'],
  'Naya': ['W', 'R', 'G'],
  'Esper': ['W', 'U', 'B'],
  'Mardu': ['W', 'R', 'B'],
  'Sultai': ['U', 'B', 'G'],
  'Temur': ['U', 'R', 'G'],
  'Abzan': ['W', 'B', 'G'],
  'Jund': ['R', 'B', 'G'],
  '4-Color': ['W', 'U', 'B', 'R', 'G'],
  '5-Color': ['W', 'U', 'B', 'R', 'G'],
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get current meta snapshot for a format
 *
 * Uses 4-hour cache. Returns combined Top 8 + Goldfish data.
 *
 * @param format - Magic format (standard, pioneer, modern, commander)
 * @returns Current meta snapshot with archetypes
 */
export async function getMetaSnapshot(
  format: 'standard' | 'pioneer' | 'modern' | 'commander'
): Promise<MetaData> {
  const cacheKey = `meta-${format}`;

  // Check cache
  let cached = getCachedData<MetaData>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const snapshot = await fetchMetaData(format);
  const metaData: MetaData = {
    format,
    archetypes: snapshot.archetypes,
    snapshotDate: snapshot.snapshotDate,
    source: snapshot.source,
  };

  // Cache for 4 hours
  setCachedData(cacheKey, metaData);

  return metaData;
}

/**
 * Score a deck against current meta
 *
 * @param deckCards - Map of card names to quantities
 * @param format - Format to analyze
 * @param deckName - Deck name for reporting
 * @param deckId - Optional deck ID
 * @returns Deck meta score with archetype match
 */
export async function scoreDeckAgainstMeta(
  deckCards: Map<string, number>,
  format: 'standard' | 'pioneer' | 'modern' | 'commander',
  deckName: string = 'Unnamed',
  deckId: string = ''
): Promise<DeckMetaScore> {
  const meta = await getMetaSnapshot(format);

  // Find best archetype match
  let bestMatch: DeckMetaScore['archetypeMatch'] = null;
  let bestScore = 0;

  for (const archetype of meta.archetypes) {
    const deckCardNames = Array.from(deckCards.keys());
    const matchedCards = archetype.keyCards.filter(card =>
      deckCardNames.some(deckCard =>
        deckCard.toLowerCase().includes(card.toLowerCase()) ||
        card.toLowerCase().includes(deckCard.toLowerCase())
      )
    ).length;

    const similarity = matchedCards / Math.max(archetype.keyCards.length, 1);

    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = {
        archetype: archetype.name,
        similarity,
        matchedCards,
        keyCardsInDeck: matchedCards,
      };
    }
  }

  // Calculate overall meta score (0-100)
  const comments: string[] = [];
  let metaScore = 50; // Base score

  if (bestMatch) {
    // Boost based on archetype popularity
    const archetypeShare = meta.archetypes.find(a => a.name === bestMatch!.archetype)?.metaShare || 0;
    metaScore = 50 + (archetypeShare / 2); // 50-100 range based on meta%

    if (bestMatch.similarity > 0.7) {
      comments.push(`🎯 Strong match for ${bestMatch.archetype} (${(bestMatch.similarity * 100).toFixed(0)}% similar)`);
    } else if (bestMatch.similarity > 0.4) {
      comments.push(`✓ Decent match for ${bestMatch.archetype}`);
    }

    if (archetypeShare > 10) {
      comments.push(`📈 ${bestMatch.archetype} is dominating (${archetypeShare.toFixed(1)}% meta)`);
    }
  } else {
    comments.push('⚠️ Unique archetype - not widely played');
    metaScore = 35;
  }

  // Check for banned cards (would need format validator)
  // TODO: Integrate with format-validator to check bans

  return {
    deckId,
    deckName,
    format,
    metaScore: Math.min(100, Math.max(0, Math.round(metaScore))),
    archetypeMatch: bestMatch,
    comments,
  };
}

/**
 * Detect significant shifts in format meta
 *
 * Compares current meta against previous snapshot.
 *
 * @param previousMeta - Previous meta snapshot
 * @param currentMeta - Current meta snapshot
 * @returns List of archetypes that shifted significantly
 */
export function detectMetaShift(previousMeta: MetaData, currentMeta: MetaData) {
  const shifts: Array<{
    archetype: string;
    previousShare: number;
    currentShare: number;
    changePercentage: number;
    direction: 'up' | 'down';
    significance: 'minor' | 'moderate' | 'major';
  }> = [];

  for (const current of currentMeta.archetypes) {
    const previous = previousMeta.archetypes.find(a => a.name === current.name);

    if (!previous) {
      // New archetype
      if (current.metaShare >= 2) {
        shifts.push({
          archetype: current.name,
          previousShare: 0,
          currentShare: current.metaShare,
          changePercentage: current.metaShare,
          direction: 'up',
          significance: current.metaShare > 5 ? 'major' : 'moderate',
        });
      }
      continue;
    }

    const change = current.metaShare - previous.metaShare;
    const absChange = Math.abs(change);

    if (absChange >= META_SHIFT_THRESHOLDS.MINOR) {
      let significance: 'minor' | 'moderate' | 'major' = 'minor';
      if (absChange >= META_SHIFT_THRESHOLDS.MAJOR) {
        significance = 'major';
      } else if (absChange >= META_SHIFT_THRESHOLDS.MODERATE) {
        significance = 'moderate';
      }

      shifts.push({
        archetype: current.name,
        previousShare: previous.metaShare,
        currentShare: current.metaShare,
        changePercentage: change,
        direction: change > 0 ? 'up' : 'down',
        significance,
      });
    }
  }

  return shifts;
}

/**
 * Analyze deck composition against meta
 *
 * Provides insights on mana curve, colors, synergies.
 *
 * @param deckCards - Map of card names to quantities
 * @returns Deck composition analysis
 */
export async function analyzeDeckComposition(
  deckCards: Map<string, number>
): Promise<Partial<DeckAnalysis>> {
  const cardNames = Array.from(deckCards.keys());

  // Get card data from Scryfall
  const cardData = await getCards(cardNames);

  let creatureCount = 0;
  let spellCount = 0;
  let landCount = 0;
  let totalMana = 0;
  let manaCount = 0;
  const colors: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

  for (const [name, quantity] of deckCards) {
    const card = cardData.get(name);
    if (!card) continue;

    // Categorize by type
    const type = card.type_line?.toLowerCase() || '';
    if (type.includes('creature')) {
      creatureCount += quantity;
    } else if (type.includes('land')) {
      landCount += quantity;
    } else {
      spellCount += quantity;
    }

    // Calculate mana cost
    const cmc = card.cmc || 0;
    totalMana += cmc * quantity;
    manaCount += quantity;

    // Count colors
    const cardColors = card.colors || card.card_faces?.[0]?.colors || [];
    for (const color of cardColors) {
      colors[color as keyof typeof colors] = (colors[color as keyof typeof colors] || 0) + quantity;
    }
  }

  const avgManaCost = manaCount > 0 ? totalMana / manaCount : 0;

  return {
    avgManaCost,
    colorIdentity: colors as any,
    creatureCount,
    spellCount,
    landCount,
  };
}

/**
 * Find top cards across meta archetypes
 *
 * @param format - Format to analyze
 * @param limit - How many cards to return
 * @returns Most played cards in meta
 */
export async function getMetaKeyCards(
  format: 'standard' | 'pioneer' | 'modern' | 'commander',
  limit: number = 20
): Promise<Array<{ cardName: string; appearances: number; inArchetypes: string[] }>> {
  const meta = await getMetaSnapshot(format);

  // Combine key cards from all archetypes
  const cardAppearances = new Map<string, { count: number; archetypes: string[] }>();

  for (const archetype of meta.archetypes) {
    for (const card of archetype.keyCards) {
      const existing = cardAppearances.get(card) || { count: 0, archetypes: [] };
      existing.count += 1;
      existing.archetypes.push(archetype.name);
      cardAppearances.set(card, existing);
    }
  }

  // Sort by appearances
  return Array.from(cardAppearances.entries())
    .map(([cardName, data]) => ({
      cardName,
      appearances: data.count,
      inArchetypes: [...new Set(data.archetypes)],
    }))
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, limit);
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Fetch and merge meta data from both sources
 */
async function fetchMetaData(
  format: 'standard' | 'pioneer' | 'modern' | 'commander'
): Promise<MetaSnapshot> {
  const archetypeMap = new Map<string, {
    metaShare: number;
    winRate: number | null;
    cards: Set<string>;
    keyCards: string[];
    colors: string[];
  }>();

  // Fetch from both sources
  try {
    // Top 8 data
    if (format === 'standard' || format === 'pioneer') {
      const top8Format = format.charAt(0).toUpperCase() + format.slice(1) as 'Standard' | 'Pioneer';
      const top8Decks = await fetchTop8Decks(top8Format, 8);

      for (const deck of top8Decks) {
        const existing = archetypeMap.get(deck.name) || {
          metaShare: 0,
          winRate: null,
          cards: new Set(),
          keyCards: [],
          colors: [],
        };

        // Add cards from this deck
        for (const card of deck.cards.keys()) {
          existing.cards.add(card);
        }

        if (!existing.keyCards.length) {
          existing.keyCards = Array.from(deck.cards.keys()).slice(0, 10);
        }

        archetypeMap.set(deck.name, existing);
      }
    }

    // Goldfish data
    if (format === 'standard' || format === 'pioneer' || format === 'modern') {
      const goldfishDecks = await fetchGoldfishDecks(format as 'standard' | 'pioneer' | 'modern', 10);

      for (const deck of goldfishDecks) {
        const existing = archetypeMap.get(deck.name) || {
          metaShare: 0,
          winRate: null,
          cards: new Set(),
          keyCards: [],
          colors: [],
        };

        existing.metaShare = deck.metaShare;

        // Add cards from this deck
        for (const card of deck.cards.keys()) {
          existing.cards.add(card);
        }

        if (!existing.keyCards.length) {
          // Get top cards by frequency
          const cardFreq = new Map<string, number>();
          for (const [card, qty] of deck.cards) {
            cardFreq.set(card, (cardFreq.get(card) || 0) + qty);
          }
          existing.keyCards = Array.from(cardFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([card]) => card);
        }

        // Infer colors from archetype name
        for (const [typePrefix, archColors] of Object.entries(ARCHETYPE_COLORS)) {
          if (deck.name.toLowerCase().includes(typePrefix.toLowerCase())) {
            existing.colors = archColors;
            break;
          }
        }

        archetypeMap.set(deck.name, existing);
      }
    }
  } catch (error) {
    console.error(`Failed to fetch meta for ${format}:`, error);
  }

  // Convert to meta archetypes
  const archetypes: MetaSnapshot['archetypes'] = Array.from(archetypeMap.entries())
    .map(([name, data]) => ({
      name,
      metaShare: data.metaShare,
      winRate: data.winRate,
      keyCards: data.keyCards,
      colors: data.colors,
    }))
    .sort((a, b) => b.metaShare - a.metaShare);

  return {
    format,
    source: 'combined',
    archetypes,
    snapshotDate: new Date(),
  };
}

/**
 * Extract colors from archetype name
 */
function getArchetypeColors(archetypeName: string): string[] {
  for (const [prefix, colors] of Object.entries(ARCHETYPE_COLORS)) {
    if (archetypeName.toLowerCase().includes(prefix.toLowerCase())) {
      return colors;
    }
  }
  return [];
}

/**
 * Calculate similarity between two card lists
 */
function calculateCardSimilarity(cards1: string[], cards2: string[]): number {
  const set1 = new Set(cards1.map(c => c.toLowerCase()));
  const set2 = new Set(cards2.map(c => c.toLowerCase()));

  const intersection = [...set1].filter(card => set2.has(card)).length;
  const union = new Set([...set1, ...set2]).size;

  return union > 0 ? intersection / union : 0;
}
