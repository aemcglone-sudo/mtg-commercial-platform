/**
 * Magic Agent System - Main Export Index
 *
 * Central exports for all agent types, utilities, and database helpers.
 */

// Core types
export * from './types';

// Database helpers
export * from './db-queries';

// Job runner framework
export {
  JOB_THRESHOLDS,
  isDataStale,
  getCachedData,
  setCachedData,
  executeJobAsync,
  getDataWithAutoRefresh,
  getJobStatus,
  getJobResult,
  clearStaleCache,
  getCacheStats,
  rateLimiter,
  processBatch,
} from './job-runner';

// Agent modules - Week 2
export {
  getMetaSnapshot,
  scoreDeckAgainstMeta,
  detectMetaShift,
  analyzeDeckComposition,
  getMetaKeyCards,
  type DeckMetaScore,
} from './meta-analyzer';

export {
  getCardPrice,
  getCardPrices,
  detectPriceAnomaly,
  getPriceTrend,
  calculateCollectionValue,
  getCollectionValueTrend,
  refreshCardPrices,
  detectAnomalies,
  findBuyingOpportunities,
  findSellingOpportunities,
  updateCollectionPrices,
  formatPrice,
  formatPercentChange,
  type PriceAnomaly,
  type CardPrice,
} from './price-tracker';

export {
  validateDeck,
  checkBannedStatus,
  getFormatInfo,
  detectRotationImpact,
  syncBannedList,
  findDecksWithBannedCards,
  getCopyLimit,
  getMinDeckSize,
  isSingletonFormat,
  summarizeValidation,
  hasBlockingErrors,
} from './format-validator';

// Agent modules - Week 3
export {
  optimizeDeck,
  analyzeManaCurve,
  findMissingKeyCards,
  suggestCardSwaps,
  generateRecommendations,
  type OptimizationReport,
} from './deck-optimizer';

export {
  getCardRecommendations,
  findSynergies,
  identifyUnusedCards,
  rankRecommendationsByValue,
  detectCombos,
  type DetailedRecommendation,
} from './card-recommender';

export {
  recordDeckCreated,
  recordDeckPlayed,
  recordSuggestionAdopted,
  recordSuggestionRejected,
  getUserProfile,
  predictNextDeckDirection,
  analyzeAdoptionPatterns,
  calculateExpertiseLevel,
  estimatePersonalizationConfidence,
} from './learning-engine';

// Agent modules - Week 4
export {
  findCheaperAlternatives,
  calculateDeckPrice,
  suggestBudgetBuilds,
  identifyPremiumCards,
  getBudgetOptimizationSummary,
} from './budget-optimizer';

export {
  findNearbyVenuesForUser,
  findVenuesByFormats,
  searchVenues,
  getVenueDetails,
  submitVenue,
  rateVenue,
  getTrendingCommunities,
  recommendVenuesByPreference,
  getCommunityStats,
  findSimilarPlayersNearby,
  exportVenueDirectory,
  type VenueSearchCriteria,
  type VenueWithDistance,
} from './community-locator';

// Agent modules (will be exported as they're created in Week 5+)
// export * from './suggestion-engine';
