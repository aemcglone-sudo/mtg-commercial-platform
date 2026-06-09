/**
 * Magic Agent System - Core Type Definitions
 *
 * Centralized types for all agent modules, database tables, and API responses.
 * This file should be imported by all agent modules and API routes.
 */

// ============================================================================
// DATABASE ENTITY TYPES
// ============================================================================

/**
 * Price history snapshot for a single card
 */
export interface PriceHistory {
  id: string;
  cardName: string;
  source: 'scryfall' | 'tcgplayer' | 'cardmarket';
  priceUsd: number | null;
  priceFoilUsd: number | null;
  capturedAt: Date;
}

/**
 * Analytical data about a user's deck
 */
export interface DeckAnalysis {
  id: string;
  userId: string;
  deckId: string;
  analyzedAt: Date;
  avgManaCost: number | null;
  colorIdentity: ColorIdentity | null; // JSON: {W: count, U: count, ...}
  creatureCount: number | null;
  spellCount: number | null;
  landCount: number | null;
  synergiesDetected: SynergyGroup[] | null; // JSON array
  metaScore: number | null; // 0-100
  tourneyAppearances: number | null; // How many Top 8 lists have these cards
  successRate: number | null; // Win rate if user tracked it
  playedDate: Date | null;
  notes: string | null;
}

/**
 * Pre-computed card synergy relationships
 */
export interface CardSynergy {
  id: string;
  cardName: string;
  synergyPartner: string;
  synergyType: 'combo' | 'synergy' | 'tribal' | 'color_fix';
  strength: number; // 0-1 scale
  note: string | null; // e.g., "Infinite loop with Monolith"
}

/**
 * User's Magic preferences and play style
 */
export interface UserPreferences {
  id: string;
  userId: string;
  favoriteFormats: string[] | null; // JSON: ['commander', 'modern']
  playStyle: 'aggro' | 'control' | 'combo' | 'tempo' | 'ramp' | null;
  budgetRange: 'budget' | 'moderate' | 'competitive' | 'unlimited' | null;
  collectorOrPlayer: 'collector' | 'player' | 'both' | null;
  acceptanceRate: number | null; // % of suggestions user adopts
  averageDeckTurnaround: string | null; // How quickly they build decks
  colorPreferences: ColorPreferences | null; // JSON: {W: 0.8, U: 0.6, ...}
  updatedAt: Date;
}

/**
 * Suggestion recommendation record
 */
export interface Suggestion {
  id: string;
  userId: string;
  deckId: string | null;
  cardName: string | null;
  suggestionType: 'card_acquisition' | 'deck_improvement' | 'format_warning' | 'price_opportunity' | 'meta_tech' | 'combo_upgrade';
  reason: string | null;
  suggestedAt: Date;
  adopted: boolean | null;
  adoptedAt: Date | null;
  userFeedback: string | null;
}

/**
 * Snapshot of banned/restricted cards for a format
 */
export interface BannedListSnapshot {
  id: string;
  format: 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander';
  bannedCards: string[] | null; // JSON array
  restrictedCards: string[] | null; // JSON array (Vintage/Legacy only)
  snapshotDate: Date;
}

/**
 * Community venue for Magic play
 */
export interface CommunityVenue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  formats: string[] | null; // JSON: ['standard', 'modern', 'commander']
  eventTypes: string[] | null; // JSON: ['tournament', 'casual', 'league']
  website: string | null;
  phone: string | null;
  verifiedAt: Date | null;
  userRating: number | null; // 0-5 stars
  reviewCount: number | null;
  createdAt: Date;
}

// ============================================================================
// API RESPONSE & INTERNAL TYPES
// ============================================================================

/**
 * Color identity/mana cost breakdown
 */
export interface ColorIdentity {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C?: number; // Colorless
}

/**
 * User's color preference weights (0-1 per color)
 */
export interface ColorPreferences {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
}

/**
 * Detected synergy group in a deck
 */
export interface SynergyGroup {
  name: string; // e.g., "Infinite Loops", "Card Draw Engines"
  cards: string[];
  strength: 'weak' | 'moderate' | 'strong';
}

/**
 * Meta snapshot from tournaments
 */
export interface MetaData {
  format: 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander';
  archetypes: Archetype[];
  snapshotDate: Date;
  source: 'top8' | 'goldfish' | 'combined';
}

/**
 * Deck archetype in meta with win rate and composition
 */
export interface Archetype {
  name: string; // e.g., "Izzet Control"
  metaShare: number; // Percentage (0-100)
  winRate: number | null; // Percentage if available
  keyCards: string[]; // Top cards in archetype
  colors: string[]; // Mana colors
}

/**
 * Price point for a card over time
 */
export interface PricePoint {
  cardName: string;
  date: Date;
  price: number | null;
  foilPrice: number | null;
}

/**
 * Price trend analysis
 */
export interface PriceTrend {
  cardName: string;
  direction: 'up' | 'down' | 'stable';
  change: number; // Percentage change
  magnitude: 'small' | 'moderate' | 'large';
  pricePoints: PricePoint[];
}

/**
 * Collection value trend over time
 */
export interface ValueTrend {
  userId: string;
  totalValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  calculatedAt: Date;
}

/**
 * Deck validation result
 */
export interface ValidationResult {
  deckId: string;
  format: string;
  isLegal: boolean;
  issues: ValidationIssue[];
}

/**
 * Single validation issue with a deck
 */
export interface ValidationIssue {
  type: 'banned' | 'restricted' | 'too_many_copies' | 'wrong_color_identity' | 'unknown_card';
  cardName: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Ban status for a card in a format
 */
export interface BanStatus {
  cardName: string;
  format: string;
  status: 'legal' | 'banned' | 'restricted' | 'suspended' | 'unknown';
  announcedDate: Date | null;
}

/**
 * Format information including rotation dates
 */
export interface FormatInfo {
  format: string;
  legality: 'legal' | 'unsupported';
  cardPool: string[]; // Set codes included
  nextRotationDate: Date | null;
  banList: BanStatus[];
}

/**
 * Format rotation warning
 */
export interface RotationWarning {
  deckId: string;
  deckName: string;
  rotatingCards: string[];
  rotationDate: Date;
  impactScore: number; // 0-100, how much deck is affected
}

/**
 * Mana curve analysis
 */
export interface CurveAnalysis {
  deckId: string;
  distribution: Record<number, number>; // CMC -> count
  average: number;
  median: number;
  forFormat: string;
  healthScore: number; // 0-100
  issues: string[];
}

/**
 * Key card suggestion for a deck
 */
export interface KeyCardSuggestion {
  cardName: string;
  currentlyOwned: boolean;
  appearanceRate: number; // % of similar meta decks
  synergyScore: number; // 0-100
  estimatedPrice: number | null;
  reason: string;
}

/**
 * Card swap suggestion
 */
export interface CardSwap {
  cardToRemove: string;
  cardToAdd: string;
  reason: string;
  impactScore: number; // 0-100, improvement magnitude
  costDifference: number | null; // Positive = remove more expensive
}

/**
 * User's learning profile from their deck history
 */
export interface UserLearningProfile {
  userId: string;
  totalDecksBuilt: number;
  favoriteColors: string[];
  favoriteFormats: string[];
  favoriteStrategies: string[];
  averageSuggestionAcceptance: number; // 0-1
  bestPerformingArchetype: string | null;
  suggestion_adoption_by_type: Record<string, number>; // Type -> acceptance rate
  lastUpdated: Date;
}

/**
 * Predicted next deck for a user
 */
export interface PredictedDeck {
  archetype: string;
  probability: number; // 0-1
  recommendedCards: string[];
  formatPreference: string;
}

/**
 * Recommendation for user (card/deck improvement)
 */
export interface Recommendation {
  id: string;
  userId: string;
  deckId: string | null;
  type: 'card_acquisition' | 'deck_improvement' | 'combo_upgrade' | 'format_tech';
  cardName: string | null;
  reason: string;
  metaRelevance: number; // 0-100
  synergyStrength: number; // 0-100
  adoptionProbability: number; // 0-1
  userPreferenceMatch: number; // 0-1
  estimatedPrice: number | null;
  score: number; // Overall ranking score (0-100)
}

/**
 * Cheaper alternative card suggestion
 */
export interface Alternative {
  originalCard: string;
  alternativeCard: string;
  priceDifference: number; // Positive = save money
  functionalSimilarity: number; // 0-1, how similar mechanically
  tourneytested: boolean; // Has it appeared in tournaments?
  reason: string;
}

/**
 * Budget-optimized deck suggestion
 */
export interface BudgetDeck {
  archetype: string;
  estimatedCost: number;
  cardList: Record<string, number>;
  notes: string;
  competitiveViability: number; // 0-100
}

/**
 * Premium card analysis
 */
export interface PremiumCardAnalysis {
  cardName: string;
  currentPrice: number;
  budgetAlternatives: Alternative[];
  valueAddedScore: number; // 0-100, how much it improves deck
  replacementCost: number; // Cost to replace with alternatives
}

/**
 * Community venue
 */
export interface Venue {
  id: string;
  name: string;
  city: string;
  state: string;
  formats: string[];
  eventTypes: string[];
  website: string | null;
  distance: number | null; // Miles from user (if location available)
  userRating: number | null;
}

/**
 * Upcoming MTG event
 */
export interface Event {
  id: string;
  venueId: string;
  venueName: string;
  eventName: string;
  format: string;
  date: Date;
  eventType: 'tournament' | 'casual' | 'league';
  entryFee: number | null;
  prizePool: string | null;
  registrationUrl: string | null;
}

/**
 * Player match by similar deck
 */
export interface Player {
  userId: string;
  username: string;
  city: string | null;
  decksWithSimilarCards: {
    deckId: string;
    deckName: string;
    overlapPercentage: number;
  }[];
}

/**
 * Deck cost breakdown
 */
export interface DeckCostBreakdown {
  deckId: string;
  totalCost: number;
  byCardType: Record<string, number>; // Type -> total cost
  expensiveCards: { cardName: string; price: number; quantity: number }[];
  budgetCards: { cardName: string; price: number; quantity: number }[];
}

/**
 * Unused card in collection
 */
export interface UnusedCardSuggestion {
  cardName: string;
  quantity: number;
  potentialDecks: string[]; // Archetypes it could go in
  synergyPotential: number; // 0-100
}

/**
 * Meta change/shift
 */
export interface MetaChange {
  archetype: string;
  previousShare: number;
  currentShare: number;
  changePercentage: number;
  direction: 'up' | 'down';
  significance: 'minor' | 'moderate' | 'major';
}

/**
 * Background job context
 */
export interface JobContext {
  userId?: string;
  jobType: 'price_update' | 'meta_refresh' | 'banned_list_check';
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

/**
 * Job result
 */
export interface JobResult {
  jobId: string;
  success: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  startedAt: Date;
  completedAt: Date;
  error?: string;
}
