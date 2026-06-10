import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    // For now, use a default user ID (single-user app)
    // When Phase 2 adds multi-user, this will use authenticated user ID
    const userId = req.headers.get('x-user-id') || 'default-user';

    // Get collection stats
    const stats = await prisma.collectionStats.findUnique({
      where: { userId },
    });

    // Get card counts by type
    const items = await prisma.inventoryItem.findMany({
      where: { userId, itemType: 'cards' },
      include: {
        _count: true,
      },
    });

    const paperCount = items
      .filter(i => i.collectionType === 'paper')
      .reduce((sum, i) => sum + (i.quantity || 0), 0);

    const arenaCount = items
      .filter(i => i.collectionType === 'arena')
      .reduce((sum, i) => sum + (i.quantity || 0), 0);

    // Get top valuable cards
    const topCards: Array<{name: string; quantity: number; price: number; totalValue: number}> = [];

    for (const item of items.slice(0, 10)) {
      const price = await prisma.cardPrice.findFirst({
        where: { cardName: item.name },
        orderBy: { lastUpdated: 'desc' },
      });

      if (price?.priceUsd) {
        topCards.push({
          name: item.name,
          quantity: item.quantity || 0,
          price: price.priceUsd,
          totalValue: price.priceUsd * (item.quantity || 0),
        });
      }
    }

    topCards.sort((a, b) => b.totalValue - a.totalValue);

    // Get recent price updates
    const recentPrices = await prisma.cardPrice.findMany({
      orderBy: { lastUpdated: 'desc' },
      take: 20,
      select: {
        cardName: true,
        priceUsd: true,
        lastUpdated: true,
      },
    });

    return NextResponse.json({
      collection: {
        totalValue: stats?.totalValueUsd ?? 0,
        valueChange7d: stats?.valueChange7d ?? 0,
        uniqueCards: stats?.uniqueCardCount ?? 0,
        totalCards: stats?.totalCardCount ?? 0,
        paperCards: paperCount,
        arenaCards: arenaCount,
        lastUpdated: stats?.lastUpdated,
      },
      topCards: topCards.map(card => ({
        name: card.name,
        quantity: card.quantity,
        price: card.price,
        totalValue: card.totalValue,
      })),
      recentPrices: recentPrices.map(p => ({
        name: p.cardName,
        price: p.priceUsd,
        updated: p.lastUpdated,
      })),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
