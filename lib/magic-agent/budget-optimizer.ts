/**
 * Magic Agent - Budget Optimizer
 *
 * Finds cheaper alternatives to expensive cards.
 * Analyzes cost vs. performance tradeoffs.
 * Helps budget players build competitive decks.
 * Suggests where to spend vs. where to save.
 */

import { getCard, getCards } from '@/lib/scryfall';
import { getCardPrice, getCardPrices } from './price-tracker';
import { getCardSynergies } from './db-queries';
import type { Alternative, BudgetDeck, PremiumCardAnalysis } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Card role categories for finding replacements
 */
const CARD_ROLES: Record<string, string[]> = {
  'mana_dork': ['creature', 'mana', 'acceleration'],
  'draw': ['draw', 'card advantage'],
  'removal': ['remove', 'destroy', 'exile', 'bounce'],
  'counter': ['counter', 'prevent'],
  'lord': ['creature', '+1/+1', 'anthem'],
  'tutor': ['search', 'tutor', 'fetch'],
};

/**
 * Price tiers for budget decisions
 */
const PRICE_TIERS = {
  VERY_CHEAP: 1,
  CHEAP: 5,
  MODERATE: 20,
  EXPENSIVE: 50,
  VERY_EXPENSIVE: 100,
} as const;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Find cheaper alternatives to a card
 *
 * @param cardName - Card to find alternatives for
 * @param format - Format to consider
 * @param maxPrice - Max price for alternative
 * @returns Cheaper alternatives ranked by similarity
 */
export async function findCheaperAlternatives(
  cardName: string,
  format: string,
  maxPrice?: number
): Promise<Alternative[]> {
  const card = await getCard(cardName);
  if (!card) return [];

  const currentPrice = await getCardPrice(cardName);
  const cardManaValue = card.cmc || 0;
  const cardType = card.type_line?.toLowerCase() || '';
  const cardColors = card.colors || card.card_faces?.[0]?.colors || [];

  const alternatives: Alternative[] = [];

  // Determine what "role" this card plays
  const roles = inferCardRole(card);

  // Search for similar cards
  // In a real system, we'd query Scryfall advanced search
  // For now, we'll use EDHREC/tournament data fallback

  // Find cards with similar mana cost (±1)
  const similarCostMin = Math.max(0, cardManaValue - 1);
  const similarCostMax = cardManaValue + 1;

  // Get all cards (simplified - would use search API)
  // This is a stub - real implementation would search Scryfall
  const candidates = await findCandidateReplacements(cardName, roles, format);

  for (const candidate of candidates) {
    const candidateCard = await getCard(candidate.name);
    if (!candidateCard) continue;

    const candidatePrice = await getCardPrice(candidate.name);
    if (!candidatePrice?.price) continue;

    // Only include if cheaper
    const priceDifference = (currentPrice?.price || 100) - (candidatePrice.price || 0);
    if (priceDifference <= 0) continue;

    // If max price specified, respect it
    if (maxPrice && candidatePrice.price > maxPrice) continue;

    // Calculate functional similarity (0-1)
    const similarity = calculateCardSimilarity(card, candidateCard);

    // Check if it's tournament-tested
    const tourneyTested = candidate.metaAppearances > 0;

    alternatives.push({
      originalCard: cardName,
      alternativeCard: candidate.name,
      priceDifference,
      functionalSimilarity: similarity,
      tourneytested: tourneyTested,
      reason: `${candidate.name} costs $${candidatePrice.price.toFixed(2)} (save $${priceDifference.toFixed(2)})`,
    });
  }

  return alternatives
    .sort((a, b) => {
      // Prioritize: similarity * tournament-tested * price savings
      const scoreA = a.functionalSimilarity * (a.tourneytested ? 1.5 : 1) * (a.priceDifference / 10);
      const scoreB = b.functionalSimilarity * (b.tourneytested ? 1.5 : 1) * (b.priceDifference / 10);
      return scoreB - scoreA;
    })
    .slice(0, 5);
}

/**
 * Calculate total deck cost with breakdown
 *
 * @param deckCards - Map of card names to quantities
 * @returns Cost breakdown by card type
 */
export async function calculateDeckPrice(
  deckCards: Map<string, number>
): Promise<{ totalCost: number; byCardType: Record<string, number>; expensiveCards: Array<{ cardName: string; price: number; quantity: number }> }> {
  const cardNames = Array.from(deckCards.keys());
  const prices = await getCardPrices(cardNames);
  const cardData = await getCards(cardNames);

  let totalCost = 0;
  const byCardType: Record<string, number> = {};
  const expensive: Array<{ cardName: string; price: number; quantity: number }> = [];

  for (const [cardName, quantity] of deckCards) {
    const priceData = prices.get(cardName);
    if (!priceData?.price) continue;

    const cost = priceData.price * quantity;
    totalCost += cost;

    // Group by card type
    const card = cardData.get(cardName);
    const type = card?.type_line?.split('—')[0]?.trim() || 'Other';
    byCardType[type] = (byCardType[type] || 0) + cost;

    // Track expensive cards
    if (priceData.price >= 10) {
      expensive.push({
        cardName,
        price: priceData.price,
        quantity,
      });
    }
  }

  return {
    totalCost: totalCost,
    byCardType: byCardType,
    expensiveCards: expensive
      .map(c => ({ ...c }))
      .sort((a, b) => b.price * b.quantity - a.price * a.quantity)
      .slice(0, 10),
  };
}

/**
 * Generate budget builds of an archetype
 *
 * @param archetype - Deck archetype (e.g., "Izzet Control")
 * @param maxPrice - Maximum budget
 * @returns Budget-optimized deck list
 */
export async function suggestBudgetBuilds(
  archetype: string,
  maxPrice: number
): Promise<BudgetDeck[]> {
  // In a real system, would fetch archetype skeleton from meta
  // Then optimize by replacing expensive cards

  const builds: BudgetDeck[] = [];

  // Tier 1: Ultra-budget (under $50)
  builds.push({
    archetype: `Budget ${archetype}`,
    estimatedCost: Math.min(maxPrice, 50),
    cardList: {}, // Would populate from meta
    notes: 'Focuses on functional alternatives, minimal interaction',
    competitiveViability: 40,
  });

  // Tier 2: Mid-budget (under $150)
  builds.push({
    archetype: `Competitive ${archetype}`,
    estimatedCost: Math.min(maxPrice, 150),
    cardList: {},
    notes: 'Includes key cards, some budget replacements',
    competitiveViability: 70,
  });

  // Tier 3: Near-optimal (under $300)
  builds.push({
    archetype: `Optimized ${archetype}`,
    estimatedCost: Math.min(maxPrice, 300),
    cardList: {},
    notes: 'Nearly complete, only swapping unproven tech',
    competitiveViability: 90,
  });

  return builds.filter(b => b.estimatedCost <= maxPrice);
}

/**
 * Analyze which cards in a deck add premium cost without value
 *
 * @param deckCards - Deck to analyze
 * @returns Premium cards that could be replaced
 */
export async function identifyPremiumCards(
  deckCards: Map<string, number>
): Promise<PremiumCardAnalysis[]> {
  const analyses: PremiumCardAnalysis[] = [];
  const cardNames = Array.from(deckCards.keys());
  const prices = await getCardPrices(cardNames);

  for (const [cardName, quantity] of deckCards) {
    const priceData = prices.get(cardName);
    if (!priceData?.price || priceData.price < 10) continue; // Only flag expensive cards

    // Find alternatives
    const alternatives = await findCheaperAlternatives(cardName, '', priceData.price * 0.5);

    if (alternatives.length > 0) {
      // Calculate total value added
      let valueAddedScore = 75; // Base score

      // Check if it's meta-relevant
      const card = await getCard(cardName);
      if (card?.legalities?.commander === 'banned') {
        valueAddedScore -= 25; // Bad in commander
      }

      // Check if it has synergies (expensive for a reason)
      const synergies = await getCardSynergies(cardName);
      if (synergies.length > 0) {
        valueAddedScore += 10; // Has synergies, worth it
      }

      const replacementCost = alternatives[0]
        ? (await getCardPrice(alternatives[0].alternativeCard))?.price || priceData.price
        : priceData.price;

      analyses.push({
        cardName,
        currentPrice: priceData.price,
        budgetAlternatives: alternatives,
        valueAddedScore: Math.max(0, Math.min(100, valueAddedScore)),
        replacementCost,
      });
    }
  }

  return analyses.sort((a, b) => {
    // Rank by: price saved * quality score
    const scoreA =
      (a.currentPrice - a.replacementCost) * (100 - a.valueAddedScore) / 100;
    const scoreB =
      (b.currentPrice - b.replacementCost) * (100 - b.valueAddedScore) / 100;
    return scoreB - scoreA;
  });
}

/**
 * Get budget optimization summary
 *
 * @param deckCards - Deck to optimize
 * @param targetBudget - Target max cost
 * @returns Summary of savings opportunities
 */
export async function getBudgetOptimizationSummary(
  deckCards: Map<string, number>,
  targetBudget: number
): Promise<{
  currentCost: number;
  targetCost: number;
  savings: number;
  opportunities: number;
  suggestions: Array<{ swap: string; savings: number }>;
  viability: number; // 0-100, how competitive at target budget
}> {
  const pricing = await calculateDeckPrice(deckCards);
  const premiumCards = await identifyPremiumCards(deckCards);

  let savings = 0;
  const suggestions: Array<{ swap: string; savings: number }> = [];

  for (const premium of premiumCards) {
    const alt = premium.budgetAlternatives[0];
    if (!alt) continue;

    const swapSavings = alt.priceDifference;
    savings += swapSavings * (deckCards.get(premium.cardName) || 1);

    if (savings < pricing.totalCost - targetBudget) {
      suggestions.push({
        swap: `Replace ${premium.cardName} with ${alt.alternativeCard}`,
        savings: swapSavings,
      });
    }
  }

  // Estimate competitiveness based on card quality
  const viability = 80 - (premiumCards.length > 3 ? 20 : 0);

  return {
    currentCost: pricing.totalCost,
    targetCost: targetBudget,
    savings: Math.min(savings, Math.max(0, pricing.totalCost - targetBudget)),
    opportunities: premiumCards.length,
    suggestions: suggestions.slice(0, 3),
    viability: Math.max(0, Math.min(100, viability)),
  };
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Infer what "role" a card plays in a deck
 */
function inferCardRole(card: any): string[] {
  const roles: string[] = [];
  const text = (card.oracle_text || '').toLowerCase();
  const type = (card.type_line || '').toLowerCase();

  if (text.includes('draw') || text.includes('card') && text.includes('gain')) {
    roles.push('draw');
  }
  if (text.includes('mana') && (type.includes('creature') || text.includes('produce'))) {
    roles.push('mana_dork');
  }
  if (text.includes('destroy') || text.includes('remove') || text.includes('exile')) {
    roles.push('removal');
  }
  if (text.includes('counter')) {
    roles.push('counter');
  }
  if (text.includes('+1/+1') || text.includes('all creatures')) {
    roles.push('lord');
  }
  if (text.includes('search') || text.includes('tutors')) {
    roles.push('tutor');
  }

  return roles.length > 0 ? roles : ['creature'];
}

/**
 * Find candidate replacement cards for a given card
 */
async function findCandidateReplacements(
  cardName: string,
  roles: string[],
  format: string
): Promise<Array<{ name: string; metaAppearances: number }>> {
  // Stub: in real implementation, would search Scryfall
  // For now return empty array
  return [];
}

/**
 * Calculate how similar two cards are (0-1)
 *
 * Considers: mana cost, type, ability overlap, color
 */
function calculateCardSimilarity(card1: any, card2: any): number {
  let similarity = 0;

  // Mana cost similarity (same ±1)
  const cmc1 = card1.cmc || 0;
  const cmc2 = card2.cmc || 0;
  if (Math.abs(cmc1 - cmc2) <= 1) {
    similarity += 0.3;
  }

  // Type line similarity
  if (card1.type_line === card2.type_line) {
    similarity += 0.4;
  }

  // Color similarity
  const colors1 = new Set(card1.colors || []);
  const colors2 = new Set(card2.colors || []);
  const overlap = [...colors1].filter(c => colors2.has(c)).length;
  const colorSim = overlap / Math.max(colors1.size, colors2.size, 1);
  similarity += colorSim * 0.3;

  return Math.min(1, similarity);
}
