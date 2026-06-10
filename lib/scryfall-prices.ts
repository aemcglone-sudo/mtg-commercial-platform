import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'dev.db');
const db = new Database(dbPath);

interface CardPriceData {
  name: string;
  set?: string;
  usd?: number;
  usd_foil?: number;
  eur?: number;
}

/**
 * Fetch current prices for cards from Scryfall
 */
export async function fetchScryfallPrices(cardNames: string[]): Promise<CardPriceData[]> {
  const results: CardPriceData[] = [];

  for (const cardName of cardNames) {
    try {
      // Search for exact card match
      const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);

      if (!response.ok) {
        console.warn(`Card not found: ${cardName}`);
        continue;
      }

      const data = await response.json() as any;
      results.push({
        name: data.name,
        set: data.set?.toUpperCase(),
        usd: data.prices?.usd ? parseFloat(data.prices.usd) : undefined,
        usd_foil: data.prices?.usd_foil ? parseFloat(data.prices.usd_foil) : undefined,
        eur: data.prices?.eur ? parseFloat(data.prices.eur) : undefined,
      });

      // Be nice to Scryfall API - they ask for a delay
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching ${cardName}:`, error);
    }
  }

  return results;
}

/**
 * Store prices in database
 */
export function storePrices(prices: CardPriceData[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO card_prices
      (id, cardName, cardSetCode, priceUsd, priceFoilUsd, priceEur, source, lastUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  for (const price of prices) {
    const id = `${price.name}-${price.set || 'any'}-scryfall`;
    stmt.run(
      id,
      price.name,
      price.set,
      price.usd ?? null,
      price.usd_foil ?? null,
      price.eur ?? null,
      'scryfall',
      now
    );
  }
}

/**
 * Store price history snapshot
 */
export function archivePrices(): void {
  const stmt = db.prepare(`
    INSERT INTO price_history (id, cardName, cardSetCode, priceUsd, priceFoilUsd, recordedAt)
    SELECT
      printf('%s-%s-%s', cardName, cardSetCode, datetime('now')),
      cardName,
      cardSetCode,
      priceUsd,
      priceFoilUsd,
      datetime('now')
    FROM card_prices
    WHERE priceUsd IS NOT NULL
  `);

  stmt.run();
}

/**
 * Detect price spikes (>5% change)
 */
export function detectSpikes(): Array<{cardName: string; previousPrice: number; currentPrice: number; changePercent: number}> {
  const spikes: Array<{cardName: string; previousPrice: number; currentPrice: number; changePercent: number}> = [];

  const stmt = db.prepare(`
    SELECT
      cp.cardName,
      ph.priceUsd as previousPrice,
      cp.priceUsd as currentPrice,
      ROUND(((cp.priceUsd - ph.priceUsd) / ph.priceUsd) * 100, 2) as changePercent
    FROM card_prices cp
    LEFT JOIN price_history ph ON
      cp.cardName = ph.cardName AND
      cp.cardSetCode = ph.cardSetCode AND
      ph.recordedAt = (
        SELECT MAX(recordedAt) FROM price_history
        WHERE cardName = cp.cardName AND cardSetCode = cp.cardSetCode
      )
    WHERE cp.priceUsd IS NOT NULL
      AND ph.priceUsd IS NOT NULL
      AND ABS((cp.priceUsd - ph.priceUsd) / ph.priceUsd) > 0.05
    ORDER BY changePercent DESC
  `);

  const rows = stmt.all() as any[];
  for (const row of rows) {
    spikes.push({
      cardName: row.cardName,
      previousPrice: row.previousPrice,
      currentPrice: row.currentPrice,
      changePercent: row.changePercent,
    });
  }

  return spikes;
}

/**
 * Get current price for a card
 */
export function getCardPrice(cardName: string): {usd?: number; foil?: number} | null {
  const stmt = db.prepare(`
    SELECT priceUsd, priceFoilUsd FROM card_prices
    WHERE cardName = ?
    ORDER BY lastUpdated DESC
    LIMIT 1
  `);

  const result = stmt.get(cardName) as any;
  if (!result) return null;

  return {
    usd: result.priceUsd ?? undefined,
    foil: result.priceFoilUsd ?? undefined,
  };
}

/**
 * Get all unique card names from user collection
 */
export function getCollectionCardNames(): string[] {
  const stmt = db.prepare(`
    SELECT DISTINCT name FROM inventory_items
    WHERE itemType = 'cards'
    ORDER BY name
  `);

  const rows = stmt.all() as any[];
  return rows.map(r => r.name).filter((name): name is string => typeof name === 'string');
}

/**
 * Calculate collection total value
 */
export function calculateCollectionValue(userId: string): {totalValue: number; cardCount: number} {
  const stmt = db.prepare(`
    SELECT
      SUM(COALESCE(cp.priceUsd, 0) * ii.quantity) as totalValue,
      COUNT(DISTINCT ii.id) as cardCount
    FROM inventory_items ii
    LEFT JOIN card_prices cp ON ii.name = cp.cardName
    WHERE ii.userId = ? AND ii.itemType = 'cards'
  `);

  const result = stmt.get(userId) as any;
  return {
    totalValue: result?.totalValue ?? 0,
    cardCount: result?.cardCount ?? 0,
  };
}

/**
 * Update collection stats
 */
export function updateCollectionStats(userId: string): void {
  const {totalValue} = calculateCollectionValue(userId);

  // Get value from 7 days ago
  const prevStmt = db.prepare(`
    SELECT SUM(priceUsd) as prevValue FROM price_history
    WHERE cardName IN (
      SELECT DISTINCT name FROM inventory_items WHERE userId = ? AND itemType = 'cards'
    )
    AND recordedAt > datetime('now', '-7 days')
    AND recordedAt < datetime('now', '-6 days')
  `);
  const prevResult = prevStmt.get(userId) as any;
  const prevValue = prevResult?.prevValue ?? totalValue;
  const valueChange7d = prevValue > 0 ? ((totalValue - prevValue) / prevValue) * 100 : 0;

  // Count cards
  const countStmt = db.prepare(`
    SELECT
      COUNT(DISTINCT name) as uniqueCount,
      SUM(quantity) as totalCount
    FROM inventory_items
    WHERE userId = ? AND itemType = 'cards'
  `);
  const countResult = countStmt.get(userId) as any;

  const upsertStmt = db.prepare(`
    INSERT OR REPLACE INTO collection_stats
      (id, userId, totalValueUsd, valueChange7d, uniqueCardCount, totalCardCount, lastUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  upsertStmt.run(
    `stats-${userId}`,
    userId,
    totalValue,
    valueChange7d,
    countResult?.uniqueCount ?? 0,
    countResult?.totalCount ?? 0,
    new Date().toISOString()
  );
}
