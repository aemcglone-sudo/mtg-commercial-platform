import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'dev.db');

export async function GET(req: NextRequest) {
  try {
    // For now, use a default user ID (single-user app)
    // When Phase 2 adds multi-user, this will use authenticated user ID
    const userId = req.headers.get('x-user-id') || 'default-user';

    const db = new Database(dbPath);

    // Get collection stats
    const statsStmt = db.prepare(`
      SELECT
        totalValueUsd,
        valueChange7d,
        uniqueCardCount,
        totalCardCount,
        lastUpdated
      FROM collection_stats
      WHERE userId = ?
    `);
    const stats = statsStmt.get(userId) as any;

    // Get card counts by type
    const typeStmt = db.prepare(`
      SELECT
        SUM(CASE WHEN collectionType = 'paper' THEN quantity ELSE 0 END) as paperCount,
        SUM(CASE WHEN collectionType = 'arena' THEN quantity ELSE 0 END) as arenaCount
      FROM inventory_items
      WHERE userId = ? AND itemType = 'cards'
    `);
    const counts = typeStmt.get(userId) as any;

    // Get top valuable cards
    const topStmt = db.prepare(`
      SELECT
        ii.name,
        ii.quantity,
        COALESCE(cp.priceUsd, 0) as price,
        COALESCE(cp.priceUsd, 0) * ii.quantity as totalValue
      FROM inventory_items ii
      LEFT JOIN card_prices cp ON ii.name = cp.cardName
      WHERE ii.userId = ? AND ii.itemType = 'cards'
      ORDER BY totalValue DESC
      LIMIT 10
    `);
    const topCards = topStmt.all(userId) as any[];

    // Get recent price updates
    const pricesStmt = db.prepare(`
      SELECT
        cardName,
        priceUsd,
        lastUpdated
      FROM card_prices
      ORDER BY lastUpdated DESC
      LIMIT 20
    `);
    const recentPrices = pricesStmt.all() as any[];

    return NextResponse.json({
      collection: {
        totalValue: stats?.totalValueUsd ?? 0,
        valueChange7d: stats?.valueChange7d ?? 0,
        uniqueCards: stats?.uniqueCardCount ?? 0,
        totalCards: stats?.totalCardCount ?? 0,
        paperCards: counts?.paperCount ?? 0,
        arenaCards: counts?.arenaCount ?? 0,
        lastUpdated: stats?.lastUpdated,
      },
      topCards: topCards.map((card: any) => ({
        name: card.name,
        quantity: card.quantity,
        price: card.price,
        totalValue: card.totalValue,
      })),
      recentPrices: recentPrices.map((p: any) => ({
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
