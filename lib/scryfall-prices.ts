import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
export async function storePrices(prices: CardPriceData[]): Promise<void> {
  for (const price of prices) {
    const id = `${price.name}-${price.set || 'any'}-scryfall`;

    await prisma.cardPrice.upsert({
      where: { id },
      update: {
        priceUsd: price.usd ?? null,
        priceFoilUsd: price.usd_foil ?? null,
        priceEur: price.eur ?? null,
        lastUpdated: new Date(),
      },
      create: {
        id,
        cardName: price.name,
        cardSetCode: price.set ?? null,
        priceUsd: price.usd ?? null,
        priceFoilUsd: price.usd_foil ?? null,
        priceEur: price.eur ?? null,
        source: 'scryfall',
      },
    });
  }
}

/**
 * Store price history snapshot
 */
export async function archivePrices(): Promise<void> {
  const prices = await prisma.cardPrice.findMany({
    where: { priceUsd: { not: null } },
  });

  for (const price of prices) {
    const id = `${price.cardName}-${price.cardSetCode || 'any'}-${Date.now()}`;

    await prisma.priceHistory.create({
      data: {
        id,
        cardName: price.cardName,
        cardSetCode: price.cardSetCode,
        priceUsd: price.priceUsd,
        priceFoilUsd: price.priceFoilUsd,
        recordedAt: new Date(),
      },
    });
  }
}

/**
 * Get current price for a card
 */
export async function getCardPrice(cardName: string): Promise<{usd?: number; foil?: number} | null> {
  const price = await prisma.cardPrice.findFirst({
    where: { cardName },
    orderBy: { lastUpdated: 'desc' },
  });

  if (!price) return null;

  return {
    usd: price.priceUsd ?? undefined,
    foil: price.priceFoilUsd ?? undefined,
  };
}

/**
 * Get all unique card names from user collection
 */
export async function getCollectionCardNames(): Promise<string[]> {
  const items = await prisma.inventoryItem.findMany({
    where: { itemType: 'cards' },
    select: { name: true },
    distinct: ['name'],
    orderBy: { name: 'asc' },
  });

  return items.map(i => i.name).filter((name): name is string => typeof name === 'string');
}

/**
 * Calculate collection total value
 */
export async function calculateCollectionValue(userId: string): Promise<{totalValue: number; cardCount: number}> {
  const items = await prisma.inventoryItem.findMany({
    where: { userId, itemType: 'cards' },
    include: { deckItems: true },
  });

  let totalValue = 0;
  const cardCount = items.length;

  for (const item of items) {
    const price = await getCardPrice(item.name);
    if (price?.usd) {
      totalValue += (price.usd * (item.quantity || 1));
    }
  }

  return { totalValue, cardCount };
}

/**
 * Update collection stats
 */
export async function updateCollectionStats(userId: string): Promise<void> {
  const { totalValue, cardCount } = await calculateCollectionValue(userId);

  // Get items for unique card count
  const uniqueCards = await prisma.inventoryItem.findMany({
    where: { userId, itemType: 'cards' },
    distinct: ['name'],
    select: { name: true },
  });

  const totalItems = await prisma.inventoryItem.aggregate({
    where: { userId, itemType: 'cards' },
    _sum: { quantity: true },
  });

  // Count duplicates (items with qty > 1)
  const duplicates = await prisma.inventoryItem.findMany({
    where: { userId, itemType: 'cards', quantity: { gt: 1 } },
  });

  const duplicateCount = duplicates.reduce((sum, item) => sum + (item.quantity - 1), 0);

  const statsId = `stats-${userId}`;

  await prisma.collectionStats.upsert({
    where: { id: statsId },
    update: {
      totalValueUsd: totalValue,
      uniqueCardCount: uniqueCards.length,
      totalCardCount: totalItems._sum.quantity || 0,
      duplicateCount,
      lastUpdated: new Date(),
    },
    create: {
      id: statsId,
      userId,
      totalValueUsd: totalValue,
      uniqueCardCount: uniqueCards.length,
      totalCardCount: totalItems._sum.quantity || 0,
      duplicateCount,
    },
  });
}
