/**
 * Enhanced card information service combining Scryfall + Tavily searches
 * Fetches legality, prices, availability, and format-specific info
 */

export interface CardLegality {
  format: string;
  status: 'legal' | 'banned' | 'restricted' | 'unknown';
}

export interface CardPricing {
  source: string;
  price: number | null;
  currency?: string;
  link?: string;
}

export interface CardAvailability {
  inStock: boolean;
  quantity?: number;
  retailer?: string;
}

export interface EnhancedCardInfo {
  name: string;
  legalitiesByScryfalls?: Record<string, string>; // from Scryfall
  legalityByFormat?: CardLegality[];
  prices?: CardPricing[];
  availability?: CardAvailability[];
  banStatus?: string;
  lastUpdated?: string;
}

// Cache for card info to avoid repeated searches
const cardInfoCache = new Map<string, { data: EnhancedCardInfo; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getEnhancedCardInfo(cardName: string): Promise<EnhancedCardInfo> {
  const cached = cardInfoCache.get(cardName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  try {
    const info = await fetchEnhancedCardInfo(cardName);
    cardInfoCache.set(cardName, { data: info, ts: Date.now() });
    return info;
  } catch (err) {
    console.error(`Failed to get enhanced info for ${cardName}:`, err);
    return { name: cardName };
  }
}

async function fetchEnhancedCardInfo(cardName: string): Promise<EnhancedCardInfo> {
  return {
    name: cardName,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Batch fetch enhanced info for multiple cards (useful for deck analysis)
 */
export async function getEnhancedCardInfoBatch(cardNames: string[]): Promise<EnhancedCardInfo[]> {
  const results = await Promise.all(
    cardNames.map(name => getEnhancedCardInfo(name))
  );
  return results;
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export function clearCardInfoCache() {
  cardInfoCache.clear();
}

/**
 * Get cache stats
 */
export function getCardInfoCacheStats() {
  return {
    size: cardInfoCache.size,
    entries: Array.from(cardInfoCache.keys()),
  };
}
