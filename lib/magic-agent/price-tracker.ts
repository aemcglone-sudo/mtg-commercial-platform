/**
 * Magic Agent - Price Tracker
 *
 * Monitors card prices from Scryfall.
 * Detects anomalies (spikes/crashes).
 * Tracks price history for value analysis.
 * Uses job runner for 2-hour cache on prices.
 */

import { getCard, getCards } from '@/lib/scryfall';
import { recordPriceSnapshot, getPriceHistory, getLatestPrice } from './db-queries';
import { getCachedData, setCachedData, isDataStale, JOB_THRESHOLDS, executeJobAsync } from './job-runner';
import type { PricePoint, PriceTrend, ValueTrend } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Price anomaly detection result
 */
export interface PriceAnomaly {
  cardName: string;
  direction: 'up' | 'down';
  magnitude: number; // Percentage change
  previousPrice: number | null;
  currentPrice: number | null;
  percentageChange: number;
  flagged: boolean; // True if > 5% change
}

/**
 * Card with price and value info
 */
export interface CardPrice {
  cardName: string;
  price: number | null;
  foilPrice: number | null;
  lastUpdated: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Thresholds for anomaly detection
 */
const ANOMALY_THRESHOLDS = {
  FLAG_THRESHOLD: 5, // % change to flag as anomaly
  SPIKE_THRESHOLD: 10, // % change to call it a spike
  CRASH_THRESHOLD: -10, // % change to call it a crash
} as const;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get current price for a card
 *
 * Uses 2-hour cache. Fetches from Scryfall if not cached.
 *
 * @param cardName - Card name
 * @returns Price data or null if not found
 */
export async function getCardPrice(cardName: string): Promise<CardPrice | null> {
  const cacheKey = `card-price-${cardName}`;

  // Check cache
  let cached = getCachedData<CardPrice>(cacheKey);
  if (cached && !isDataStale(cacheKey, JOB_THRESHOLDS.PRICE_UPDATE)) {
    return cached;
  }

  // Fetch from Scryfall
  const card = await getCard(cardName);
  if (!card) {
    setCachedData(cacheKey, null);
    return null;
  }

  const priceData: CardPrice = {
    cardName,
    price: card.prices?.usd ? parseFloat(card.prices.usd) : null,
    foilPrice: card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null,
    lastUpdated: new Date(),
  };

  // Record in database
  await recordPriceSnapshot(
    cardName,
    'scryfall',
    priceData.price,
    priceData.foilPrice
  );

  // Cache for 2 hours
  setCachedData(cacheKey, priceData);

  return priceData;
}

/**
 * Get prices for multiple cards
 *
 * @param cardNames - Array of card names
 * @returns Map of card name to price data
 */
export async function getCardPrices(cardNames: string[]): Promise<Map<string, CardPrice>> {
  const prices = new Map<string, CardPrice>();

  // Get Scryfall data
  const cardData = await getCards(cardNames);

  for (const [name, card] of cardData) {
    const priceData: CardPrice = {
      cardName: name,
      price: card.prices?.usd ? parseFloat(card.prices.usd) : null,
      foilPrice: card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null,
      lastUpdated: new Date(),
    };

    prices.set(name, priceData);

    // Record in database
    await recordPriceSnapshot(
      name,
      'scryfall',
      priceData.price,
      priceData.foilPrice
    );
  }

  return prices;
}

/**
 * Detect price anomalies for a card
 *
 * Compares current price against 30-day average.
 * Flags if change > 5%.
 *
 * @param cardName - Card name
 * @returns Anomaly detection result
 */
export async function detectPriceAnomaly(cardName: string): Promise<PriceAnomaly | null> {
  // Get price history (last 30 days)
  const history = await getPriceHistory(cardName, 30, 'scryfall');
  if (history.length === 0) {
    return null;
  }

  // Get current price
  const current = history[0];
  if (!current.price) {
    return null;
  }

  // Calculate average from previous prices
  let sum = 0;
  let count = 0;
  for (let i = 1; i < Math.min(7, history.length); i++) {
    if (history[i].price) {
      sum += history[i].price!;
      count++;
    }
  }

  if (count === 0) {
    return null;
  }

  const average = sum / count;
  const change = current.price - average;
  const percentageChange = (change / average) * 100;

  // Determine magnitude
  let magnitude = 'small';
  if (Math.abs(percentageChange) >= ANOMALY_THRESHOLDS.SPIKE_THRESHOLD) {
    magnitude = percentageChange > 0 ? 'spike' : 'crash';
  }

  return {
    cardName,
    direction: percentageChange > 0 ? 'up' : 'down',
    magnitude: Math.abs(percentageChange),
    previousPrice: count > 0 ? average : null,
    currentPrice: current.price,
    percentageChange,
    flagged: Math.abs(percentageChange) > ANOMALY_THRESHOLDS.FLAG_THRESHOLD,
  };
}

/**
 * Get price trend for a card
 *
 * @param cardName - Card name
 * @param days - How many days of history (default 30)
 * @returns Price trend with direction and history
 */
export async function getPriceTrend(
  cardName: string,
  days: number = 30
): Promise<PriceTrend | null> {
  const history = await getPriceHistory(cardName, days, 'scryfall');
  if (history.length === 0) {
    return null;
  }

  // Get oldest and newest prices
  const oldest = history[history.length - 1];
  const newest = history[0];

  if (!oldest.price || !newest.price) {
    return null;
  }

  const change = newest.price - oldest.price;
  const percentageChange = (change / oldest.price) * 100;

  // Determine trend
  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (percentageChange > 2) {
    direction = 'up';
  } else if (percentageChange < -2) {
    direction = 'down';
  }

  return {
    cardName,
    direction,
    change: percentageChange,
    magnitude:
      Math.abs(percentageChange) > 10 ? 'large' :
      Math.abs(percentageChange) > 5 ? 'moderate' :
      'small',
    pricePoints: history,
  };
}

/**
 * Calculate total collection value
 *
 * @param collectionCards - Array of cards with quantities
 * @returns Total USD value
 */
export async function calculateCollectionValue(
  collectionCards: Array<{ name: string; quantity: number }>
): Promise<number> {
  let totalValue = 0;

  const cardNames = collectionCards.map(c => c.name);
  const prices = await getCardPrices(cardNames);

  for (const card of collectionCards) {
    const price = prices.get(card.name);
    if (price?.price) {
      totalValue += price.price * card.quantity;
    }
  }

  return totalValue;
}

/**
 * Get collection value trend
 *
 * Calculates total value over time.
 * Uses cached prices for efficiency.
 *
 * @param collectionCards - Array of cards with quantities
 * @returns Value trend info
 */
export async function getCollectionValueTrend(
  collectionCards: Array<{ name: string; quantity: number }>
): Promise<ValueTrend> {
  // Get current value
  const currentValue = await calculateCollectionValue(collectionCards);

  // Get value 7 days ago (simple approximation)
  let previousValue = 0;
  for (const card of collectionCards) {
    const history = await getPriceHistory(card.name, 7, 'scryfall');
    if (history.length > 0) {
      const oldestPrice = history[history.length - 1].price;
      if (oldestPrice) {
        previousValue += oldestPrice * card.quantity;
      }
    }
  }

  const change = currentValue - previousValue;
  const percentageChange = previousValue > 0 ? (change / previousValue) * 100 : 0;

  return {
    userId: '', // Will be set by caller
    totalValue: currentValue,
    trend: percentageChange > 1 ? 'increasing' : percentageChange < -1 ? 'decreasing' : 'stable',
    changePercentage: percentageChange,
    calculatedAt: new Date(),
  };
}

/**
 * Update prices for a set of cards in the background
 *
 * Triggers lazy on-demand refresh without blocking.
 * Useful for collection price updates.
 *
 * @param cardNames - Cards to update
 * @param userId - Optional user ID for logging
 * @returns Job ID
 */
export async function refreshCardPrices(
  cardNames: string[],
  userId?: string
): Promise<string> {
  const jobId = await executeJobAsync(
    'price_update',
    async () => {
      try {
        const prices = await getCardPrices(cardNames);
        return {
          itemsProcessed: prices.size,
          error: prices.size === 0 ? 'No cards found' : undefined,
        };
      } catch (error) {
        return {
          itemsProcessed: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    { userId }
  );

  return jobId;
}

/**
 * Detect price anomalies for multiple cards
 *
 * @param cardNames - Cards to check
 * @returns Array of detected anomalies
 */
export async function detectAnomalies(cardNames: string[]): Promise<PriceAnomaly[]> {
  const anomalies: PriceAnomaly[] = [];

  for (const cardName of cardNames) {
    const anomaly = await detectPriceAnomaly(cardName);
    if (anomaly && anomaly.flagged) {
      anomalies.push(anomaly);
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange));
}

/**
 * Find cards with best price opportunity
 *
 * Detects price crashes (good time to buy).
 *
 * @param cardNames - Cards to check
 * @param threshold - Minimum % down to flag (default -5%)
 * @returns Cards sorted by price drop
 */
export async function findBuyingOpportunities(
  cardNames: string[],
  threshold: number = -5
): Promise<Array<{ cardName: string; percentageChange: number; currentPrice: number | null }>> {
  const opportunities: Array<{ cardName: string; percentageChange: number; currentPrice: number | null }> = [];

  for (const cardName of cardNames) {
    const anomaly = await detectPriceAnomaly(cardName);
    if (anomaly && anomaly.percentageChange <= threshold) {
      opportunities.push({
        cardName,
        percentageChange: anomaly.percentageChange,
        currentPrice: anomaly.currentPrice,
      });
    }
  }

  return opportunities.sort((a, b) => a.percentageChange - b.percentageChange);
}

/**
 * Find cards with selling opportunity
 *
 * Detects price spikes (good time to sell).
 *
 * @param cardNames - Cards to check
 * @param threshold - Minimum % up to flag (default 5%)
 * @returns Cards sorted by price spike
 */
export async function findSellingOpportunities(
  cardNames: string[],
  threshold: number = 5
): Promise<Array<{ cardName: string; percentageChange: number; currentPrice: number | null }>> {
  const opportunities: Array<{ cardName: string; percentageChange: number; currentPrice: number | null }> = [];

  for (const cardName of cardNames) {
    const anomaly = await detectPriceAnomaly(cardName);
    if (anomaly && anomaly.percentageChange >= threshold) {
      opportunities.push({
        cardName,
        percentageChange: anomaly.percentageChange,
        currentPrice: anomaly.currentPrice,
      });
    }
  }

  return opportunities.sort((a, b) => b.percentageChange - a.percentageChange);
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Update prices for an entire collection
 *
 * Runs in background without blocking.
 * Stores prices in database.
 * Returns immediately with cache data.
 *
 * @param collectionCards - Cards in collection
 * @param userId - User ID
 * @returns Current prices (may be from cache) + job ID for background update
 */
export async function updateCollectionPrices(
  collectionCards: Array<{ name: string; quantity: number }>,
  userId: string
): Promise<{ prices: Map<string, CardPrice>; jobId: string }> {
  const cardNames = collectionCards.map(c => c.name);
  const cacheKey = `collection-prices-${userId}`;

  // Get cached prices if available
  let cachedPrices = getCachedData<Map<string, CardPrice>>(cacheKey);
  if (cachedPrices && !isDataStale(cacheKey, JOB_THRESHOLDS.PRICE_UPDATE)) {
    // Cache is fresh, no need to refresh
    return {
      prices: cachedPrices,
      jobId: '', // No job triggered
    };
  }

  // Fetch fresh prices
  const prices = await getCardPrices(cardNames);
  setCachedData(cacheKey, prices);

  // Trigger background refresh for next time
  const jobId = await refreshCardPrices(cardNames, userId);

  return { prices, jobId };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format price for display
 *
 * @param price - Price in USD
 * @returns Formatted price string
 */
export function formatPrice(price: number | null): string {
  if (price === null) return 'N/A';
  return `$${price.toFixed(2)}`;
}

/**
 * Format percentage change for display
 *
 * @param percent - Percentage change
 * @returns Formatted percentage string
 */
export function formatPercentChange(percent: number): string {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}
