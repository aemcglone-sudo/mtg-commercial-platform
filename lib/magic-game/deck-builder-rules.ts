/**
 * Commander Deck Building Best Practices
 * Based on the "Rule of Nine" and proven deckbuilding principles
 */

import type { ScryfallCard } from './commander-types';

export interface DeckCategoryBreakdown {
  lands: ScryfallCard[];
  ramp: ScryfallCard[];
  cardDraw: ScryfallCard[];
  removal: ScryfallCard[];
  boardWipes: ScryfallCard[];
  winConditions: ScryfallCard[];
  utilityAndOther: ScryfallCard[];
}

/**
 * Categorize cards by their role in the deck
 */
export function categorizeCard(card: ScryfallCard): string[] {
  const categories: string[] = [];
  const text = (card.oracle_text || '').toLowerCase();
  const type = (card.type_line || '').toLowerCase();

  // Mana base
  if (type.includes('land')) {
    categories.push('lands');
  }

  // Ramp (mana acceleration)
  if (
    text.includes('add') ||
    text.includes('ramp') ||
    text.includes('search') ||
    text.includes('tutor') ||
    (text.includes('mana') && !text.includes('lose'))
  ) {
    categories.push('ramp');
  }

  // Card draw
  if (text.includes('draw') || text.includes('search your library')) {
    categories.push('cardDraw');
  }

  // Targeted removal (creature/artifact/enchantment specific)
  if (
    text.includes('destroy target') ||
    text.includes('exile target') ||
    text.includes('remove from game') ||
    text.includes('return target') ||
    (text.includes('target') && (text.includes('creature') || text.includes('artifact') || text.includes('enchantment')))
  ) {
    categories.push('removal');
  }

  // Board wipes (mass interaction)
  if (
    text.includes('each') ||
    text.includes('all ') ||
    (text.includes('destroy') && !text.includes('target')) ||
    (text.includes('exile') && !text.includes('target'))
  ) {
    categories.push('boardWipes');
  }

  // Win conditions (combat damage, infinite, mill, alternate)
  if (
    text.includes('combat damage') ||
    text.includes('infinite') ||
    text.includes('mill') ||
    text.includes('lose the game') ||
    text.includes('game') ||
    (type.includes('creature') && parseInt(card.power || '0') >= 5)
  ) {
    categories.push('winConditions');
  }

  // Utility and political cards
  if (text.includes('protect') || text.includes('shroud') || text.includes('hexproof')) {
    categories.push('utilityAndOther');
  }

  // Default: if no category matched, it's utility
  if (categories.length === 0) {
    categories.push('utilityAndOther');
  }

  return categories;
}

/**
 * Organize deck by category
 */
export function organizeDeckByCategory(cards: ScryfallCard[]): DeckCategoryBreakdown {
  const breakdown: DeckCategoryBreakdown = {
    lands: [],
    ramp: [],
    cardDraw: [],
    removal: [],
    boardWipes: [],
    winConditions: [],
    utilityAndOther: []
  };

  for (const card of cards) {
    const categories = categorizeCard(card);

    for (const category of categories) {
      if (category in breakdown) {
        // Only add to first matching category to avoid duplicates
        if (
          (category === 'lands' && breakdown.lands.length < 40) ||
          (category === 'ramp' && breakdown.ramp.length < 10) ||
          (category === 'cardDraw' && breakdown.cardDraw.length < 10) ||
          (category === 'removal' && breakdown.removal.length < 10) ||
          (category === 'boardWipes' && breakdown.boardWipes.length < 4) ||
          (category === 'winConditions' && breakdown.winConditions.length < 10) ||
          category === 'utilityAndOther'
        ) {
          (breakdown[category as keyof DeckCategoryBreakdown] as ScryfallCard[]).push(card);
          break; // Don't add to other categories
        }
      }
    }
  }

  return breakdown;
}

/**
 * Check deck composition health
 */
export function assessDeckComposition(breakdown: DeckCategoryBreakdown): {
  healthy: boolean;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let healthy = true;

  // Check land count (target: 36-38)
  if (breakdown.lands.length < 33) {
    warnings.push(`Too few lands (${breakdown.lands.length}) — aim for 36-38`);
    healthy = false;
  } else if (breakdown.lands.length > 40) {
    warnings.push(`Too many lands (${breakdown.lands.length}) — aim for 36-38`);
    healthy = false;
  }

  // Check ramp (target: 8-10)
  if (breakdown.ramp.length < 7) {
    suggestions.push(`Add more ramp (currently ${breakdown.ramp.length}; target 8-10)`);
  }

  // Check card draw (target: 8-10)
  if (breakdown.cardDraw.length < 7) {
    suggestions.push(`Add more card draw (currently ${breakdown.cardDraw.length}; target 8-10)`);
  }

  // Check removal (target: 8-10)
  if (breakdown.removal.length < 6) {
    suggestions.push(`Add more targeted removal (currently ${breakdown.removal.length}; target 8-10)`);
  }

  // Check board wipes (target: 2-3)
  if (breakdown.boardWipes.length < 2) {
    suggestions.push(`Add board wipes (currently ${breakdown.boardWipes.length}; target 2-3)`);
  }

  // Check win conditions
  if (breakdown.winConditions.length < 3) {
    suggestions.push(`Add clear win conditions (currently ${breakdown.winConditions.length}; need multiple paths to victory)`);
  }

  return { healthy, warnings, suggestions };
}

/**
 * Get mana curve analysis
 */
export function analyzeMananCurve(cards: ScryfallCard[]): { avgCost: number; distribution: Record<string, number> } {
  const distribution: Record<string, number> = {};
  let totalCost = 0;

  for (const card of cards) {
    const cost = card.cmc || 0;
    const bucket = cost >= 7 ? '7+' : cost.toString();

    distribution[bucket] = (distribution[bucket] || 0) + 1;
    totalCost += cost;
  }

  return {
    avgCost: cards.length > 0 ? totalCost / cards.length : 0,
    distribution
  };
}
