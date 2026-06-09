/**
 * Magic Agent - Learning Engine
 *
 * Learns from user's deck building decisions.
 * Tracks suggestion adoption to improve recommendations.
 * Builds user profile: favorite colors, strategies, formats.
 * Predicts next deck direction based on patterns.
 */

import { recordSuggestion, markSuggestionAdopted, getUserSuggestions, updateUserPreferences, getUserPreferences, saveDeckAnalysis } from './db-queries';
import { analyzeDeckComposition } from './meta-analyzer';
import type {
  UserLearningProfile,
  PredictedDeck,
  ColorIdentity,
  ColorPreferences,
  UserPreferences,
  DeckAnalysis,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum decks to start learning
 */
const LEARNING_THRESHOLDS = {
  EARLY_PERSONALIZATION: 5, // After 5 decks, start personalizing
  HIGH_CONFIDENCE: 20, // After 20 decks, high confidence in profile
  EXPERTISE: 50, // After 50 decks, expert level predictions
} as const;

/**
 * Typical archetype/strategy by color combination
 */
const COLOR_ARCHETYPES: Record<string, string[]> = {
  'W': ['Weenie', 'Protection', 'Life Gain'],
  'U': ['Control', 'Draw', 'Tempo'],
  'B': ['Discard', 'Sacrifice', 'Removal'],
  'R': ['Aggro', 'Burn', 'Tempo'],
  'G': ['Ramp', 'Creature Swarm', 'Stompy'],
  'WU': ['Azorius Control', 'Fliers', 'Tempo'],
  'UB': ['Dimir Control', 'Mill', 'Rogues'],
  'BR': ['Rakdos Aggro', 'Sacrifice', 'Burn'],
  'RG': ['Gruul Aggro', 'Ramp', 'Stompy'],
  'GW': ['Selesnya Midrange', 'Tokens', 'Ramp'],
  'WB': ['Orzhov Midrange', 'Removal', 'Control'],
  'UR': ['Izzet Tempo', 'Spellslinger', 'Draw'],
  'BG': ['Sultai Midrange', 'Removal', 'Ramp'],
  'RW': ['Boros Aggro', 'Tokens', 'Midrange'],
  'GU': ['Simic Ramp', 'Growth', 'Tempo'],
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Record a new deck creation
 *
 * Called when user saves a new deck. Analyzes composition and stores profile data.
 *
 * @param userId - User ID
 * @param deckId - Deck ID
 * @param deckName - Deck name
 * @param deckCards - Map of card names to quantities
 * @param format - Format
 * @param strategy - Optional strategy description
 */
export async function recordDeckCreated(
  userId: string,
  deckId: string,
  deckName: string,
  deckCards: Map<string, number>,
  format: 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander',
  strategy?: string
): Promise<void> {
  // Analyze deck composition
  const composition = await analyzeDeckComposition(deckCards);

  // Save analysis
  await saveDeckAnalysis(userId, deckId, {
    avgManaCost: composition.avgManaCost,
    colorIdentity: composition.colorIdentity,
    creatureCount: composition.creatureCount,
    spellCount: composition.spellCount,
    landCount: composition.landCount,
  });

  // Update user preferences based on this deck
  const prefs = await getUserPreferences(userId);
  const existingFormats = prefs?.favoriteFormats || [];
  const existingColors = prefs?.colorPreferences || { W: 0, U: 0, B: 0, R: 0, G: 0 };

  // Update color preferences
  if (composition.colorIdentity) {
    const colorIdentity = composition.colorIdentity as unknown as Record<string, number>;
    for (const [color, count] of Object.entries(colorIdentity)) {
      if ((count as number) > 0) {
        existingColors[color as keyof typeof existingColors] =
          ((existingColors[color as keyof typeof existingColors] || 0) * 0.8) + ((count as number) * 0.2);
      }
    }
  }

  // Update format preferences
  if (!existingFormats.includes(format)) {
    existingFormats.push(format);
  }

  // Infer play style from deck composition
  let playStyle = inferPlayStyle(composition);

  await updateUserPreferences(userId, {
    favoriteFormats: existingFormats,
    colorPreferences: existingColors,
    playStyle: playStyle as any,
  });
}

/**
 * Record game result for a deck
 *
 * @param userId - User ID
 * @param deckId - Deck ID
 * @param result - 'win' or 'loss'
 */
export async function recordDeckPlayed(
  userId: string,
  deckId: string,
  result: 'win' | 'loss'
): Promise<void> {
  // Would update deck win/loss record in database
  // For now, just track that the deck was played
  console.log(`Deck ${deckId} recorded: ${result}`);
}

/**
 * Record that user adopted a suggestion
 *
 * @param userId - User ID
 * @param suggestionId - Suggestion ID
 * @param feedback - Optional user feedback
 */
export async function recordSuggestionAdopted(
  userId: string,
  suggestionId: string,
  feedback?: string
): Promise<void> {
  await markSuggestionAdopted(suggestionId, feedback);

  // Update user preferences - higher acceptance rate
  const prefs = await getUserPreferences(userId);
  const currentRate = prefs?.acceptanceRate || 0.5;
  const newRate = currentRate * 0.9 + 0.1; // Moving average towards 1.0

  await updateUserPreferences(userId, {
    acceptanceRate: newRate,
  });
}

/**
 * Record that user rejected a suggestion
 *
 * @param userId - User ID
 * @param suggestionId - Suggestion ID
 * @param feedback - Optional feedback on why
 */
export async function recordSuggestionRejected(
  userId: string,
  suggestionId: string,
  feedback?: string
): Promise<void> {
  // Mark as not adopted but with feedback
  // Would need to update database schema to handle rejection separately
  console.log(`Suggestion ${suggestionId} rejected: ${feedback}`);
}

/**
 * Get comprehensive user learning profile
 *
 * @param userId - User ID
 * @param userDecks - User's decks
 * @returns Full learning profile
 */
export async function getUserProfile(
  userId: string,
  userDecks: Array<{ id: string; name: string; cards: Map<string, number> }>
): Promise<UserLearningProfile> {
  const prefs = await getUserPreferences(userId);
  const suggestions = await getUserSuggestions(userId, 100);

  // Calculate adoption rates by suggestion type
  const adoptionByType: Record<string, number> = {};
  const typeCount: Record<string, number> = {};

  for (const sugg of suggestions) {
    const type = sugg.suggestionType;
    typeCount[type] = (typeCount[type] || 0) + 1;

    if (sugg.adopted) {
      adoptionByType[type] = (adoptionByType[type] || 0) + 1;
    }
  }

  for (const [type, count] of Object.entries(adoptionByType)) {
    adoptionByType[type] = (count as number) / (typeCount[type] || 1);
  }

  // Determine confidence level
  const deckCount = userDecks.length;
  let confidenceLevel = 'low';
  if (deckCount >= LEARNING_THRESHOLDS.HIGH_CONFIDENCE) {
    confidenceLevel = 'high';
  } else if (deckCount >= LEARNING_THRESHOLDS.EARLY_PERSONALIZATION) {
    confidenceLevel = 'medium';
  }

  return {
    userId,
    totalDecksBuilt: deckCount,
    favoriteColors: rankByPreference(prefs?.colorPreferences || undefined),
    favoriteFormats: prefs?.favoriteFormats || [],
    favoriteStrategies: inferStrategies(userDecks),
    averageSuggestionAcceptance: prefs?.acceptanceRate || 0.5,
    bestPerformingArchetype: findBestArchetype(userDecks),
    suggestion_adoption_by_type: adoptionByType,
    lastUpdated: new Date(),
  };
}

/**
 * Predict what deck user might build next
 *
 * @param userId - User ID
 * @param userDecks - User's decks
 * @param userPreferences - User preferences
 * @returns Predicted next decks
 */
export async function predictNextDeckDirection(
  userId: string,
  userDecks: Array<{ id: string; name: string; cards: Map<string, number>; format?: string }>,
  userPreferences?: UserPreferences
): Promise<PredictedDeck[]> {
  const predictions: PredictedDeck[] = [];

  if (userDecks.length < LEARNING_THRESHOLDS.EARLY_PERSONALIZATION) {
    return predictions; // Not enough data
  }

  const prefs = userPreferences || (await getUserPreferences(userId));
  if (!prefs) return predictions;

  // Find least-explored colors
  const colorPrefs = (prefs.colorPreferences || {}) as Record<string, number>;
  const colorScores = Object.entries(colorPrefs)
    .map(([color, score]) => ({ color, score: score as number }))
    .sort((a, b) => a.score - b.score);

  // Predict decks based on unexplored colors + preferred formats
  const formats = prefs.favoriteFormats || ['standard'];
  const playStyle = prefs.playStyle || 'control';

  for (let i = 0; i < Math.min(2, colorScores.length); i++) {
    const color = colorScores[i].color;
    const format = formats[i % formats.length];

    // Find archetypes for this color
    const archetypes = COLOR_ARCHETYPES[color] || ['Unknown'];
    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    predictions.push({
      archetype: `${color} ${archetype}`,
      probability: 0.6 - i * 0.2, // Decreasing probability
      recommendedCards: [], // Would fetch from meta
      formatPreference: format,
    });
  }

  return predictions;
}

/**
 * Analyze adoption patterns to improve recommendations
 *
 * @param userId - User ID
 * @returns Insights on which recommendation types work best
 */
export async function analyzeAdoptionPatterns(userId: string): Promise<{
  bestTypes: Array<{ type: string; adoptionRate: number }>;
  worstTypes: Array<{ type: string; adoptionRate: number }>;
  insights: string[];
}> {
  const suggestions = await getUserSuggestions(userId, 100);
  const adoptionByType: Record<string, { adopted: number; total: number }> = {};

  for (const sugg of suggestions) {
    const type = sugg.suggestionType;
    if (!adoptionByType[type]) {
      adoptionByType[type] = { adopted: 0, total: 0 };
    }
    adoptionByType[type].total += 1;
    if (sugg.adopted) {
      adoptionByType[type].adopted += 1;
    }
  }

  const rates = Object.entries(adoptionByType)
    .map(([type, counts]) => ({
      type,
      adoptionRate: (counts as { adopted: number; total: number }).adopted / (counts as { adopted: number; total: number }).total,
    }))
    .sort((a, b) => (b as { adoptionRate: number }).adoptionRate - (a as { adoptionRate: number }).adoptionRate);

  const bestTypes = rates.slice(0, 3);
  const worstTypes = rates.slice(-3).reverse();

  const insights: string[] = [];
  if (bestTypes[0]?.adoptionRate > 0.8) {
    insights.push(`User loves ${bestTypes[0].type} suggestions`);
  }
  if (worstTypes[0]?.adoptionRate < 0.3) {
    insights.push(`${worstTypes[0].type} suggestions rarely adopted - reconsider approach`);
  }

  return { bestTypes, worstTypes, insights };
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Infer play style from deck composition
 */
function inferPlayStyle(
  composition: Partial<DeckAnalysis>
): 'aggro' | 'control' | 'combo' | 'tempo' | 'ramp' | null {
  const creatures = composition.creatureCount || 0;
  const spells = composition.spellCount || 0;
  const lands = composition.landCount || 0;
  const avgCmc = composition.avgManaCost || 2;

  const totalCards = creatures + spells + lands;
  const creatureRatio = creatures / totalCards;
  const spellRatio = spells / totalCards;

  // Determine archetype
  if (avgCmc < 2.5 && creatureRatio > 0.6) {
    return 'aggro';
  } else if (avgCmc > 3.5 && spellRatio > 0.4) {
    return 'control';
  } else if (avgCmc > 4 && spellRatio > 0.5) {
    return 'ramp';
  } else if (spellRatio > 0.6) {
    return 'combo';
  } else {
    return 'tempo';
  }
}

/**
 * Rank colors by preference
 */
function rankByPreference(colorPrefs?: ColorPreferences): string[] {
  if (!colorPrefs) return [];

  return Object.entries(colorPrefs)
    .map(([color, score]) => ({ color, score }))
    .sort((a, b) => b.score - a.score)
    .filter(x => x.score > 0)
    .map(x => x.color);
}

/**
 * Infer strategies from user's decks
 */
function inferStrategies(userDecks: Array<{ id: string; name: string; cards: Map<string, number> }>): string[] {
  const strategies = new Set<string>();

  // Look for common keywords in deck names
  const keywords: Record<string, string> = {
    'control': 'Control',
    'aggro': 'Aggro',
    'tempo': 'Tempo',
    'midrange': 'Midrange',
    'ramp': 'Ramp',
    'combo': 'Combo',
    'token': 'Tokens',
    'burn': 'Burn',
    'mill': 'Mill',
    'sacrifice': 'Sacrifice',
  };

  for (const deck of userDecks) {
    const name = deck.name.toLowerCase();
    for (const [keyword, strategy] of Object.entries(keywords)) {
      if (name.includes(keyword)) {
        strategies.add(strategy);
      }
    }
  }

  return Array.from(strategies);
}

/**
 * Find best performing archetype
 */
function findBestArchetype(userDecks: Array<{ id: string; name: string; cards: Map<string, number> }>): string | null {
  if (userDecks.length === 0) return null;

  // Would use game results if tracked
  // For now, return most recent deck's archetype
  return userDecks[userDecks.length - 1].name || null;
}

/**
 * Calculate user's expertise level
 */
export function calculateExpertiseLevel(deckCount: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  if (deckCount < 3) return 'beginner';
  if (deckCount < 15) return 'intermediate';
  if (deckCount < 50) return 'advanced';
  return 'expert';
}

/**
 * Estimate confidence in personalization
 *
 * How confident are we in our recommendations for this user?
 */
export function estimatePersonalizationConfidence(
  deckCount: number,
  suggestionCount: number,
  adoptionRate: number
): number {
  // Factors: deck count (experience), suggestion count (data), adoption rate (validation)
  let confidence = 0;

  // Experience factor (0-30)
  if (deckCount >= LEARNING_THRESHOLDS.HIGH_CONFIDENCE) {
    confidence += 30;
  } else if (deckCount >= LEARNING_THRESHOLDS.EARLY_PERSONALIZATION) {
    confidence += 20;
  } else {
    confidence += Math.min(10, deckCount / 2);
  }

  // Data factor (0-40)
  confidence += Math.min(40, (suggestionCount / 20) * 40);

  // Validation factor (0-30)
  confidence += adoptionRate * 30;

  return Math.round(Math.min(100, confidence));
}
