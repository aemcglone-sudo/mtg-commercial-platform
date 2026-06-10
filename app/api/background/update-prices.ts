import { NextRequest, NextResponse } from 'next/server';
import {
  getCollectionCardNames,
  fetchScryfallPrices,
  storePrices,
  archivePrices,
  updateCollectionStats,
} from '@/lib/scryfall-prices';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Background job to update card prices daily
 * Can be called via: GET /api/background/update-prices
 * Or scheduled via Fly.io scheduler
 */
export async function GET(req: NextRequest) {
  try {
    // Simple auth check
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.BACKGROUND_JOB_SECRET || 'secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    console.log('Starting daily price update...');

    // Get all card names from collection
    const cardNames = await getCollectionCardNames();
    console.log(`Found ${cardNames.length} unique cards to price`);

    if (cardNames.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cards in collection',
        duration: Date.now() - startTime,
      });
    }

    // Sample if too many cards (avoid API limits)
    const sampleSize = Math.min(cardNames.length, 100);
    const sampled = cardNames
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);

    console.log(`Fetching prices for ${sampled.length} sampled cards...`);

    // Fetch prices from Scryfall
    const prices = await fetchScryfallPrices(sampled);
    console.log(`Fetched ${prices.length} prices`);

    // Store in database
    await storePrices(prices);
    console.log('Prices stored');

    // Archive for history
    await archivePrices();
    console.log('Prices archived to history');

    // Update stats for all users
    const users = await prisma.inventoryItem.findMany({
      where: { itemType: 'cards' },
      distinct: ['userId'],
      select: { userId: true },
    });

    for (const user of users) {
      await updateCollectionStats(user.userId);
    }
    console.log(`Updated stats for ${users.length} users`);

    return NextResponse.json({
      success: true,
      cardsPriced: prices.length,
      usersUpdated: users.length,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Price update job failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
