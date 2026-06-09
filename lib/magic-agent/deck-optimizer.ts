/**
 * Magic Agent - Deck Optimizer
 *
 * Analyzes decks for optimization opportunities.
 * Identifies missing key cards, suggests improvements.
 * Ranks suggestions by impact (meta, synergy, budget).
 * Focuses on closing gaps between current deck and optimal.
 */

import { getCards } from '@/lib/scryfall';
import { getMetaSnapshot, getMetaKeyCards, analyzeDeckComposition } from './meta-analyzer';
import { getCardSynergies, findDeckSynergies } from './db-queries';
import { getCardPrice, getCardPrices } from './price-tracker';
import { validateDeck } from './format-validator';
import type {
  CurveAnalysis,
  KeyCardSuggestion,
  CardSwap,
  Recommendation,
  SynergyGroup,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Mana curve distribution analysis
 */
interface ManaCurve {
  distribution: Record<number, number>; // CMC -> count
  average: number;
  median: number;
  mode: number;
  healthScore: number; // 0-100
  issues: string[];
}

/**
 * Deck optimization report
 */
export interface OptimizationReport {
  deckId: string;
  deckName: string;
  format: string;
  currentScore: number; // 0-100
  potentialScore: number; // With improvements
  improvementPotential: number; // Points to gain
  manaCurve: ManaCurve;
  keyCardGaps: KeyCardSuggestion[];
  cardSwaps: CardSwap[];
  synergies: SynergyGroup[];
  recommendations: Recommendation[];
  summary: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Ideal mana curve by CMC for 60-card deck
 * Based on meta analysis and proven deck building principles
 */
const IDEAL_CURVE: Record<number, number> = {
  0: 0,
  1: 8,  // 8 one-drops
  2: 8,  // 8 two-drops
  3: 8,  // 8 three-drops
  4: 6,  // 6 four-drops
  5: 4,  // 4 five-drops
  6: 3,  // 3 six-drops
  7: 2,  // 2 seven-drops
  8: 2,  // 2+ eight-drops
  9: 1,
  10: 1,
};

/**
 * Weights for different improvement types
 */
const IMPROVEMENT_WEIGHTS = {
  META_ALIGNMENT: 0.35, // How well it matches current meta
  SYNERGY_STRENGTH: 0.25, // How strong the synergies are
  MANA_CURVE: 0.20, // Curve optimization
  KEY_CARDS: 0.15, // Meta-critical cards
  BUDGET: 0.05, // Cost considerations
} as const;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Run comprehensive optimization analysis on a deck
 *
 * @param deckCards - Map of card names to quantities
 * @param format - Format to optimize for
 * @param deckName - Deck name for reporting
 * @param deckId - Optional deck ID
 * @param userCollection - Optional user's collection for filtering
 * @returns Full optimization report with suggestions
 */
export async function optimizeDeck(
  deckCards: Map<string, number>,
  format: 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander',
  deckName: string = 'Unnamed',
  deckId: string = '',
  userCollection?: Map<string, number>
): Promise<OptimizationReport> {
  // Analyze current state
  const composition = await analyzeDeckComposition(deckCards);
  const manaCurve = await analyzeManaCurve(deckCards);
  const supportedFormats = ['standard', 'pioneer', 'modern', 'commander'] as const;
  const meta = supportedFormats.includes(format as any)
    ? await getMetaSnapshot(format as 'standard' | 'pioneer' | 'modern' | 'commander')
    : { format, archetypes: [], snapshotDate: new Date(), source: 'combined' as const };
  const synergies = await findDeckSynergies(Array.from(deckCards.keys()));
  const validation = await validateDeck(deckCards, format);

  // Calculate current score
  const currentScore = calculateDeckScore(deckCards, format, meta, manaCurve);

  // Find improvements
  const keyCardGaps = await findMissingKeyCards(deckCards, format, meta);
  const cardSwaps = await suggestCardSwaps(deckCards, format, meta);
  const synergiesDetected = groupSynergies(synergies);

  // Generate recommendations
  const recommendations = await generateRecommendations(
    deckCards,
    format,
    meta,
    manaCurve,
    keyCardGaps,
    cardSwaps,
    userCollection
  );

  // Calculate potential score if recommendations adopted
  const potentialScore = calculatePotentialScore(currentScore, recommendations);
  const improvementPotential = potentialScore - currentScore;

  // Generate summary
  const summary = generateSummary(
    deckName,
    currentScore,
    potentialScore,
    keyCardGaps,
    cardSwaps,
    validation
  );

  return {
    deckId,
    deckName,
    format,
    currentScore,
    potentialScore,
    improvementPotential,
    manaCurve,
    keyCardGaps,
    cardSwaps,
    synergies: synergiesDetected,
    recommendations,
    summary,
  };
}

/**
 * Analyze mana curve of a deck
 *
 * @param deckCards - Map of card names to quantities
 * @returns Mana curve analysis with health score
 */
export async function analyzeManaCurve(deckCards: Map<string, number>): Promise<ManaCurve> {
  const cardNames = Array.from(deckCards.keys());
  const cardData = await getCards(cardNames);

  const distribution: Record<number, number> = {};
  const cmc: number[] = [];

  for (const [name, quantity] of deckCards) {
    const card = cardData.get(name);
    if (!card) continue;

    const cardCmc = card.cmc || 0;
    distribution[cardCmc] = (distribution[cardCmc] || 0) + quantity;

    for (let i = 0; i < quantity; i++) {
      cmc.push(cardCmc);
    }
  }

  // Calculate stats
  const average = cmc.length > 0 ? cmc.reduce((a, b) => a + b) / cmc.length : 0;
  const sorted = cmc.sort((a, b) => a - b);
  const median = cmc.length > 0 ? sorted[Math.floor(cmc.length / 2)] : 0;

  // Calculate mode
  let mode = 0;
  let maxCount = 0;
  for (const count of Object.values(distribution)) {
    if (count > maxCount) {
      maxCount = count;
      mode = Object.entries(distribution).find(([_, c]) => c === count)?.[0]
        ? parseInt(Object.entries(distribution).find(([_, c]) => c === count)?.[0] || '0')
        : 0;
    }
  }

  // Calculate health score
  const issues: string[] = [];
  let healthScore = 100;

  // Check against ideal curve
  for (const [cmcStr, ideal] of Object.entries(IDEAL_CURVE)) {
    const cmc = parseInt(cmcStr);
    const actual = distribution[cmc] || 0;
    const ratio = actual / ideal;

    if (ratio < 0.5) {
      healthScore -= 5;
      issues.push(`Too few ${cmc}-drops (${actual} vs ideal ${ideal})`);
    } else if (ratio > 1.5) {
      healthScore -= 3;
      issues.push(`Too many ${cmc}-drops (${actual} vs ideal ${ideal})`);
    }
  }

  // Check for mana curve extremes
  if (average > 4.5) {
    healthScore -= 10;
    issues.push('Curve is too high (avg > 4.5)');
  } else if (average < 2) {
    healthScore -= 5;
    issues.push('Curve is too low for late-game');
  }

  return {
    distribution,
    average,
    median,
    mode,
    healthScore: Math.max(0, Math.min(100, healthScore)),
    issues,
  };
}

/**
 * Find missing key cards from meta
 *
 * @param deckCards - Cards currently in deck
 * @param format - Format to analyze
 * @param meta - Current meta snapshot
 * @returns Key cards not in deck, ranked by importance
 */
export async function findMissingKeyCards(
  deckCards: Map<string, number>,
  format: string,
  meta?: any
): Promise<KeyCardSuggestion[]> {
  const metaData = meta || (await getMetaSnapshot(format as any));
  const deckCardNames = new Set(Array.from(deckCards.keys()).map(c => c.toLowerCase()));

  const missing: KeyCardSuggestion[] = [];

  // Get key cards from meta
  const metaCards = await getMetaKeyCards(format as any, 20);

  for (const metaCard of metaCards) {
    // Skip if already in deck
    if (deckCardNames.has(metaCard.cardName.toLowerCase())) {
      continue;
    }

    // Get card data
    const card = await getCards([metaCard.cardName]);
    const cardData = card.get(metaCard.cardName);
    if (!cardData) continue;

    // Calculate appearance rate
    const appearanceRate = (metaCard.appearances / metaData.archetypes.length) * 100;

    // Get price
    const priceData = await getCardPrice(metaCard.cardName);

    // Calculate synergy score with existing deck
    const synergies = await getCardSynergies(metaCard.cardName);
    const deckSynergies = synergies.filter(s =>
      deckCardNames.has(s.synergyPartner.toLowerCase())
    );
    const synergyScore = deckSynergies.length > 0
      ? deckSynergies.reduce((sum, s) => sum + s.strength, 0) * 20
      : 0;

    missing.push({
      cardName: metaCard.cardName,
      currentlyOwned: false,
      appearanceRate,
      synergyScore: Math.min(100, synergyScore),
      estimatedPrice: priceData?.price || null,
      reason: `In ${metaCard.appearances} meta archetypes (${appearanceRate.toFixed(1)}%)`,
    });
  }

  return missing
    .sort((a, b) => b.appearanceRate - a.appearanceRate)
    .slice(0, 10);
}

/**
 * Suggest card swaps for underperforming slots
 *
 * @param deckCards - Current deck
 * @param format - Format
 * @param meta - Meta snapshot
 * @returns Suggested card swaps ranked by impact
 */
export async function suggestCardSwaps(
  deckCards: Map<string, number>,
  format: string,
  meta?: any
): Promise<CardSwap[]> {
  const metaData = meta || (await getMetaSnapshot(format as any));
  const swaps: CardSwap[] = [];

  // Get all key cards from meta (only for supported formats)
  const metaKeyCards = (format === 'standard' || format === 'pioneer' || format === 'modern' || format === 'commander')
    ? await getMetaKeyCards(format as 'standard' | 'pioneer' | 'modern' | 'commander', 30)
    : [];
  const metaCardNames = new Set(metaKeyCards.map(c => c.cardName.toLowerCase()));

  // Find cards in deck that are NOT in meta key cards
  for (const [cardName] of deckCards) {
    if (metaCardNames.has(cardName.toLowerCase())) {
      continue; // This card is already meta-relevant
    }

    // Find a better alternative
    const cardData = await getCards([cardName]);
    const card = cardData.get(cardName);
    if (!card) continue;

    // Look for replacement with same type but better meta alignment
    const cardType = card.type_line?.toLowerCase() || '';
    const cardCmc = card.cmc || 0;

    // Find similar cards that are meta-relevant
    for (const metaCard of metaKeyCards) {
      const metaData = await getCards([metaCard.cardName]);
      const meta = metaData.get(metaCard.cardName);
      if (!meta) continue;

      const metaType = meta.type_line?.toLowerCase() || '';
      const metaCmc = meta.cmc || 0;

      // Similar role and cost
      if (
        cardType === metaType &&
        Math.abs(cardCmc - metaCmc) <= 1
      ) {
        // Get prices
        const currentPrice = await getCardPrice(cardName);
        const alternativePrice = await getCardPrice(metaCard.cardName);

        const costDifference =
          (currentPrice?.price || 0) - (alternativePrice?.price || 0);

        swaps.push({
          cardToRemove: cardName,
          cardToAdd: metaCard.cardName,
          reason: `${metaCard.cardName} is in ${metaCard.appearances} meta archetypes`,
          impactScore: Math.min(100, metaCard.appearances * 5),
          costDifference,
        });

        break; // Found a swap, move to next card
      }
    }
  }

  return swaps
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5);
}

/**
 * Generate ranked recommendations for deck improvement
 *
 * Combines meta alignment, synergy, mana curve, key cards into single score.
 *
 * @param deckCards - Current deck
 * @param format - Format
 * @param meta - Meta snapshot
 * @param curve - Mana curve analysis
 * @param keyCards - Missing key cards
 * @param swaps - Suggested swaps
 * @param userCollection - Optional user's current collection
 * @returns Ranked recommendations
 */
export async function generateRecommendations(
  deckCards: Map<string, number>,
  format: string,
  meta: any,
  curve: ManaCurve,
  keyCards: KeyCardSuggestion[],
  swaps: CardSwap[],
  userCollection?: Map<string, number>
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // 1. Key card recommendations
  for (const keyCard of keyCards) {
    // Skip if user doesn't have it
    if (userCollection && !userCollection.has(keyCard.cardName)) {
      continue;
    }

    const id = `rec-keycard-${keyCard.cardName}`;
    const metaRelevance = Math.min(100, keyCard.appearanceRate);
    const adoptionProbability = (keyCard.appearanceRate / 100) * 0.8; // 80% of meta rate

    recommendations.push({
      id,
      userId: '', // Set by caller
      deckId: '', // Set by caller
      type: 'card_acquisition',
      cardName: keyCard.cardName,
      reason: keyCard.reason,
      metaRelevance,
      synergyStrength: keyCard.synergyScore,
      adoptionProbability,
      userPreferenceMatch: 0.7, // Default neutral
      estimatedPrice: keyCard.estimatedPrice,
      score: 0, // Will calculate below
    });
  }

  // 2. Card swap recommendations
  for (const swap of swaps) {
    const id = `rec-swap-${swap.cardToRemove}-${swap.cardToAdd}`;
    const metaRelevance = swap.impactScore;

    recommendations.push({
      id,
      userId: '',
      deckId: '',
      type: 'deck_improvement',
      cardName: swap.cardToAdd,
      reason: `Replace ${swap.cardToRemove} with ${swap.cardToAdd}: ${swap.reason}`,
      metaRelevance,
      synergyStrength: 50, // Unknown without full analysis
      adoptionProbability: 0.6,
      userPreferenceMatch: 0.5,
      estimatedPrice: swap.costDifference ? null : (await getCardPrice(swap.cardToAdd))?.price || null,
      score: 0,
    });
  }

  // 3. Mana curve adjustments
  if (curve.healthScore < 70) {
    for (const issue of curve.issues) {
      recommendations.push({
        id: `rec-curve-${issue.split(' ')[3] || 'balance'}`,
        userId: '',
        deckId: '',
        type: 'deck_improvement',
        cardName: null,
        reason: `Mana curve issue: ${issue}`,
        metaRelevance: Math.max(0, 100 - curve.healthScore),
        synergyStrength: 30,
        adoptionProbability: 0.4,
        userPreferenceMatch: 0.5,
        estimatedPrice: null,
        score: 0,
      });
    }
  }

  // Calculate final scores
  for (const rec of recommendations) {
    rec.score = calculateRecommendationScore(rec);
  }

  // Sort by score
  return recommendations.sort((a, b) => b.score - a.score).slice(0, 15);
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Calculate overall deck score (0-100) based on multiple factors
 */
function calculateDeckScore(
  deckCards: Map<string, number>,
  format: string,
  meta: any,
  curve: ManaCurve
): number {
  let score = 50; // Base score

  // Meta alignment (0-35 points)
  const metaKeyCards = meta.archetypes
    .flatMap((a: any) => a.keyCards)
    .filter((card: string) => deckCards.has(card));
  const metaAlignment = (metaKeyCards.length / 30) * 35;
  score += Math.min(35, metaAlignment);

  // Mana curve health (0-20 points)
  score += (curve.healthScore / 100) * 20;

  // Deck size validity (0-10 points)
  const totalCards = Array.from(deckCards.values()).reduce((a, b) => a + b, 0);
  const validSize = format === 'commander' ? totalCards === 100 : totalCards >= 60;
  score += validSize ? 10 : 0;

  // Synergy potential (0-15 points)
  // Would need synergy analysis here
  score += 7.5; // Placeholder

  // Deck legality (0-10 points)
  // Would need validation here
  score += 10; // Placeholder

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate potential score if recommendations adopted
 */
function calculatePotentialScore(currentScore: number, recommendations: Recommendation[]): number {
  if (recommendations.length === 0) return currentScore;

  // Assume top 3 recommendations adopted
  const topGains = recommendations.slice(0, 3);
  const totalGain = topGains.reduce((sum, rec) => sum + (rec.metaRelevance * 0.3), 0);

  return Math.min(100, currentScore + totalGain);
}

/**
 * Calculate recommendation score (0-100)
 */
function calculateRecommendationScore(rec: Recommendation): number {
  const weights = {
    metaRelevance: 0.35,
    synergyStrength: 0.25,
    adoptionProbability: 0.20,
    userPreference: 0.15,
    costConsideration: 0.05,
  };

  const costScore = rec.estimatedPrice
    ? Math.max(0, 100 - (rec.estimatedPrice / 50) * 100)
    : 50;

  const score =
    (rec.metaRelevance * weights.metaRelevance) +
    (rec.synergyStrength * weights.synergyStrength) +
    (rec.adoptionProbability * 100 * weights.adoptionProbability) +
    (rec.userPreferenceMatch * 100 * weights.userPreference) +
    (costScore * weights.costConsideration);

  return Math.round(score);
}

/**
 * Group synergies into meaningful categories
 */
function groupSynergies(synergies: any[]): SynergyGroup[] {
  const groups: Record<string, SynergyGroup> = {};

  for (const synergy of synergies) {
    // Categorize by synergy type
    let categoryName = '';
    if (synergy.synergyType === 'combo') {
      categoryName = 'Infinite Loops & Combos';
    } else if (synergy.synergyType === 'synergy') {
      categoryName = 'Card Synergies';
    } else if (synergy.synergyType === 'tribal') {
      categoryName = 'Tribal Synergies';
    } else if (synergy.synergyType === 'color_fix') {
      categoryName = 'Mana Acceleration';
    }

    if (!groups[categoryName]) {
      groups[categoryName] = {
        name: categoryName,
        cards: [],
        strength: 'moderate',
      };
    }

    groups[categoryName].cards.push(synergy.cardName, synergy.synergyPartner);
    groups[categoryName].cards = [...new Set(groups[categoryName].cards)]; // Dedupe

    // Update strength
    if (synergy.strength > 0.8) {
      groups[categoryName].strength = 'strong';
    }
  }

  return Object.values(groups);
}

/**
 * Generate human-readable optimization summary
 */
function generateSummary(
  deckName: string,
  currentScore: number,
  potentialScore: number,
  keyCards: KeyCardSuggestion[],
  swaps: CardSwap[],
  validation: any
): string {
  const improvement = potentialScore - currentScore;
  const hasIssues = validation && !validation.isLegal;

  let summary = `**${deckName}** `;

  if (hasIssues) {
    summary += `has legal issues to resolve. `;
  }

  summary += `Currently at **${currentScore}% strength**. `;

  if (improvement > 0) {
    summary += `Can reach **${potentialScore}%** by adding ${keyCards.slice(0, 2).map(k => k.cardName).join(', ')}. `;
  }

  if (swaps.length > 0) {
    summary += `Consider swapping ${swaps[0].cardToRemove} for ${swaps[0].cardToAdd}. `;
  }

  summary += improvement > 0 ? `Potential improvement: +${Math.round(improvement)} points.` : `Deck is well-optimized.`;

  return summary;
}
