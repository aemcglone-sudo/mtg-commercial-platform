/**
 * Magic Agent - Card Recommender
 *
 * Suggests cards to acquire based on deck archetype, synergies, and collection.
 * Identifies high-synergy cards in user's collection that aren't being used.
 * Ranks by meta relevance, synergy strength, and price.
 */

import { getCard, getCards } from '@/lib/scryfall';
import { getCardSynergies, addCardSynergy, findDeckSynergies } from './db-queries';
import { getCardPrice, getCardPrices } from './price-tracker';
import { getMetaSnapshot, getMetaKeyCards } from './meta-analyzer';
import type {
  CardSynergy,
  Recommendation,
  UnusedCardSuggestion,
  SynergyGroup,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Card recommendation with full details
 */
export interface DetailedRecommendation extends Recommendation {
  synergies: CardSynergy[];
  relatedCards: string[];
  acquisitionPath: string; // Where to find the card
  urgency: 'low' | 'medium' | 'high'; // Based on meta/synergy
}

/**
 * Unused card with potential uses
 */
interface UnusedCardAnalysis {
  cardName: string;
  quantity: number;
  potentialDecks: string[];
  synergyCount: number;
  synergyStrength: number;
  recommendedDecks: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Synergy strength weights
 */
const SYNERGY_WEIGHTS = {
  COMBO: 1.0, // Infinite loops
  SYNERGY: 0.8, // Works together
  TRIBAL: 0.5, // Same type
  COLOR_FIX: 0.3, // Mana production
} as const;

/**
 * Card acquisition priorities
 */
const ACQUISITION_PRIORITY = {
  BANNED_OR_ROTATING: -100,
  COMMANDER_BANNED: -50,
  EXPENSIVE: 3,
  MODERATE: 2,
  CHEAP: 1,
  FREE_BASIC: 0,
} as const;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get card recommendations for a specific deck
 *
 * @param deckCards - Current deck composition
 * @param format - Format to recommend for
 * @param deckName - Name of deck
 * @param userCollection - User's full collection (optional)
 * @param userPreferences - User's play style (optional)
 * @returns Ranked list of recommendations
 */
export async function getCardRecommendations(
  deckCards: Map<string, number>,
  format: 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander',
  deckName: string = 'Deck',
  userCollection?: Map<string, number>,
  userPreferences?: any
): Promise<DetailedRecommendation[]> {
  const deckCardNames = Array.from(deckCards.keys());
  const recommendations: DetailedRecommendation[] = [];

  // 1. Find synergy-based recommendations
  const synergies = await findDeckSynergies(deckCardNames);
  const synergyRecs = await generateSynergyRecommendations(
    synergies,
    deckCards,
    format,
    userCollection
  );
  recommendations.push(...synergyRecs);

  // 2. Find meta-based recommendations (cards meta decks use with this archetype)
  const metaRecs = await generateMetaRecommendations(deckCards, format, userCollection);
  recommendations.push(...metaRecs);

  // 3. Find combo opportunities (high-synergy pairs)
  const comboRecs = await generateComboRecommendations(deckCards, format, userCollection);
  recommendations.push(...comboRecs);

  // Deduplicate and rank
  const uniqueRecs = new Map<string, DetailedRecommendation>();
  for (const rec of recommendations) {
    const key = rec.cardName || '';
    if (!uniqueRecs.has(key) || (uniqueRecs.get(key)?.score || 0) < rec.score) {
      rec.score = Math.round(rec.score);
      uniqueRecs.set(key, rec);
    }
  }

  return Array.from(uniqueRecs.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

/**
 * Find all synergies for a card
 *
 * @param cardName - Card to analyze
 * @returns All synergistic partners
 */
export async function findSynergies(cardName: string): Promise<CardSynergy[]> {
  return getCardSynergies(cardName);
}

/**
 * Identify high-value unused cards in collection
 *
 * Finds cards not currently in any deck that have high synergy potential.
 *
 * @param userId - User ID
 * @param userCollection - User's collection
 * @param userDecks - User's decks
 * @returns Unused cards with potential
 */
export async function identifyUnusedCards(
  userId: string,
  userCollection: Map<string, number>,
  userDecks: Array<{ id: string; name: string; cards: Map<string, number> }>
): Promise<UnusedCardSuggestion[]> {
  const suggestions: UnusedCardSuggestion[] = [];

  // Find cards in collection but not in any deck
  const usedCardNames = new Set<string>();
  for (const deck of userDecks) {
    for (const cardName of deck.cards.keys()) {
      usedCardNames.add(cardName.toLowerCase());
    }
  }

  for (const [cardName, quantity] of userCollection) {
    if (usedCardNames.has(cardName.toLowerCase())) {
      continue; // Already used
    }

    // Analyze potential
    const synergies = await getCardSynergies(cardName);
    const potentialDecks: string[] = [];
    let totalSynergyStrength = 0;

    for (const deck of userDecks) {
      for (const synergy of synergies) {
        if (deck.cards.has(synergy.synergyPartner)) {
          potentialDecks.push(deck.name);
          totalSynergyStrength += synergy.strength;
          break;
        }
      }
    }

    if (potentialDecks.length > 0) {
      suggestions.push({
        cardName,
        quantity,
        potentialDecks: [...new Set(potentialDecks)],
        synergyPotential: Math.min(100, Math.round((totalSynergyStrength / synergies.length) * 100)),
      });
    }
  }

  return suggestions.sort((a, b) => b.synergyPotential - a.synergyPotential);
}

/**
 * Rank recommendations by value
 *
 * Combines multiple signals: meta share, synergy, price, adoption likelihood.
 *
 * @param recs - Recommendations to rank
 * @returns Ranked recommendations
 */
export async function rankRecommendationsByValue(
  recs: Recommendation[]
): Promise<Recommendation[]> {
  // Calculate value score for each
  const valued = recs.map(rec => {
    // Score factors (0-100 each)
    const metaScore = rec.metaRelevance || 0;
    const synergyScore = rec.synergyStrength || 0;
    const adoptionScore = (rec.adoptionProbability || 0.5) * 100;

    // Price factor (cheaper = higher score)
    let priceScore = 50;
    if (rec.estimatedPrice) {
      if (rec.estimatedPrice < 10) priceScore = 80;
      else if (rec.estimatedPrice < 20) priceScore = 60;
      else if (rec.estimatedPrice < 50) priceScore = 40;
      else priceScore = 20;
    }

    // Weighted combination
    const valueScore =
      metaScore * 0.35 +
      synergyScore * 0.30 +
      adoptionScore * 0.20 +
      priceScore * 0.15;

    return {
      ...rec,
      score: Math.round(valueScore),
    };
  });

  return valued.sort((a, b) => b.score - a.score);
}

/**
 * Detect specific combos that use cards in deck
 *
 * @param deckCards - Deck composition
 * @returns Combo opportunities
 */
export async function detectCombos(
  deckCards: Map<string, number>
): Promise<Array<{ cards: string[]; type: string; infinite: boolean; description: string }>> {
  const combos: Array<{ cards: string[]; type: string; infinite: boolean; description: string }> = [];
  const deckCardNames = Array.from(deckCards.keys());

  // Find synergies marked as combos
  const synergies = await findDeckSynergies(deckCardNames);
  const comboSynergies = synergies.filter(s => s.synergyType === 'combo');

  for (const synergy of comboSynergies) {
    // Check if both cards are in deck
    if (deckCardNames.some(name => name.toLowerCase() === synergy.cardName.toLowerCase())) {
      combos.push({
        cards: [synergy.cardName, synergy.synergyPartner],
        type: 'Infinite Loop',
        infinite: true,
        description: synergy.note || `${synergy.cardName} combos with ${synergy.synergyPartner}`,
      });
    }
  }

  return combos;
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Generate synergy-based recommendations
 */
async function generateSynergyRecommendations(
  synergies: any[],
  deckCards: Map<string, number>,
  format: string,
  userCollection?: Map<string, number>
): Promise<DetailedRecommendation[]> {
  const recs: DetailedRecommendation[] = [];
  const deckCardNames = new Set(Array.from(deckCards.keys()).map(c => c.toLowerCase()));

  // Group synergies by partner
  const partnerMap = new Map<string, any[]>();
  for (const syn of synergies) {
    // Check if synergy partner is in deck but synergy card isn't
    if (
      deckCardNames.has(syn.synergyPartner.toLowerCase()) &&
      !deckCardNames.has(syn.cardName.toLowerCase())
    ) {
      if (!partnerMap.has(syn.cardName)) {
        partnerMap.set(syn.cardName, []);
      }
      partnerMap.get(syn.cardName)!.push(syn);
    }
  }

  // Create recommendations
  for (const [cardName, cardSynergies] of partnerMap) {
    // Skip if user doesn't have it
    if (userCollection && !userCollection.has(cardName)) {
      continue;
    }

    const totalSynergyStrength = cardSynergies.reduce((sum, s) => sum + s.strength, 0);
    const synergyCount = cardSynergies.length;

    const card = await getCard(cardName);
    const price = await getCardPrice(cardName);

    const rec: DetailedRecommendation = {
      id: `rec-syn-${cardName}`,
      userId: '',
      deckId: '',
      type: 'combo_upgrade',
      cardName,
      reason: `Synergizes with ${synergyCount} cards in your deck`,
      metaRelevance: 30, // Synergy cards aren't always meta
      synergyStrength: Math.min(100, totalSynergyStrength * 30),
      adoptionProbability: 0.7,
      userPreferenceMatch: 0.8,
      estimatedPrice: price?.price || null,
      score: 0,
      synergies: cardSynergies,
      relatedCards: cardSynergies.map(s => s.synergyPartner),
      acquisitionPath: card?.scryfall_uri ? 'Scryfall' : 'Unknown',
      urgency: totalSynergyStrength > 0.8 ? 'high' : 'medium',
    };

    recs.push(rec);
  }

  return recs;
}

/**
 * Generate meta-based recommendations
 */
async function generateMetaRecommendations(
  deckCards: Map<string, number>,
  format: string,
  userCollection?: Map<string, number>
): Promise<DetailedRecommendation[]> {
  const recs: DetailedRecommendation[] = [];

  // Get meta key cards
  const metaCards = await getMetaKeyCards(format as any, 25);
  const deckCardNames = new Set(Array.from(deckCards.keys()).map(c => c.toLowerCase()));

  for (const metaCard of metaCards) {
    // Skip if already in deck
    if (deckCardNames.has(metaCard.cardName.toLowerCase())) {
      continue;
    }

    // Skip if user doesn't have it
    if (userCollection && !userCollection.has(metaCard.cardName)) {
      continue;
    }

    const card = await getCard(metaCard.cardName);
    const price = await getCardPrice(metaCard.cardName);

    // Get synergies with deck cards
    const cardSynergies = await getCardSynergies(metaCard.cardName);
    const deckSynergies = cardSynergies.filter(s =>
      deckCardNames.has(s.synergyPartner.toLowerCase())
    );

    const rec: DetailedRecommendation = {
      id: `rec-meta-${metaCard.cardName}`,
      userId: '',
      deckId: '',
      type: 'deck_improvement', // meta-relevant card suggestion
      cardName: metaCard.cardName,
      reason: `Meta staple (in ${metaCard.appearances} archetypes)`,
      metaRelevance: Math.min(100, metaCard.appearances * 5),
      synergyStrength: Math.min(100, deckSynergies.length * 20),
      adoptionProbability: 0.85,
      userPreferenceMatch: 0.7,
      estimatedPrice: price?.price || null,
      score: 0,
      synergies: cardSynergies.slice(0, 5),
      relatedCards: deckSynergies.map(s => s.synergyPartner),
      acquisitionPath: card?.scryfall_uri ? 'Scryfall' : 'Unknown',
      urgency: metaCard.appearances > 15 ? 'high' : metaCard.appearances > 10 ? 'medium' : 'low',
    };

    recs.push(rec);
  }

  return recs;
}

/**
 * Generate combo-based recommendations
 */
async function generateComboRecommendations(
  deckCards: Map<string, number>,
  format: string,
  userCollection?: Map<string, number>
): Promise<DetailedRecommendation[]> {
  const recs: DetailedRecommendation[] = [];

  const deckCardNames = Array.from(deckCards.keys());
  const allSynergies = await findDeckSynergies(deckCardNames);

  // Find combo synergies
  const comboSynergies = allSynergies.filter(s => s.synergyType === 'combo');

  for (const synergy of comboSynergies) {
    // Check if we need the combo partner
    const deckCardNames_Set = new Set(deckCardNames.map(c => c.toLowerCase()));
    const hasFirst = deckCardNames_Set.has(synergy.cardName.toLowerCase());
    const hasSecond = deckCardNames_Set.has(synergy.synergyPartner.toLowerCase());

    let comboCard = '';
    let baseCard = '';

    if (hasFirst && !hasSecond) {
      comboCard = synergy.synergyPartner;
      baseCard = synergy.cardName;
    } else if (hasSecond && !hasFirst) {
      comboCard = synergy.cardName;
      baseCard = synergy.synergyPartner;
    } else {
      continue; // Already have both or neither
    }

    // Skip if user doesn't have it
    if (userCollection && !userCollection.has(comboCard)) {
      continue;
    }

    const card = await getCard(comboCard);
    const price = await getCardPrice(comboCard);

    const rec: DetailedRecommendation = {
      id: `rec-combo-${comboCard}`,
      userId: '',
      deckId: '',
      type: 'combo_upgrade',
      cardName: comboCard,
      reason: `Infinite combo with ${baseCard}: ${synergy.note || 'Loops infinitely'}`,
      metaRelevance: 50,
      synergyStrength: 100, // Combos are perfect synergy
      adoptionProbability: 0.9,
      userPreferenceMatch: 0.95, // Users love combos
      estimatedPrice: price?.price || null,
      score: 0,
      synergies: [synergy],
      relatedCards: [baseCard],
      acquisitionPath: card?.scryfall_uri ? 'Scryfall' : 'Unknown',
      urgency: 'high', // Combos are high priority
    };

    recs.push(rec);
  }

  return recs;
}
