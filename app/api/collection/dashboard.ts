import { NextRequest, NextResponse } from 'next/server';
import { getPrices } from '@/lib/price-cache';

export async function GET(req: NextRequest) {
  try {
    const prices = getPrices();

    // Convert to array
    const priceArray = Array.from(prices.values())
      .sort((a, b) => (b.usd || 0) - (a.usd || 0));

    const totalValue = priceArray.reduce((sum, p) => sum + (p.usd || 0), 0);

    return NextResponse.json({
      collection: {
        totalValue,
        valueChange7d: 0, // Will be calculated later
        uniqueCards: priceArray.length,
        totalCards: priceArray.length,
        paperCards: 0,
        arenaCards: 0,
        lastUpdated: new Date().toISOString(),
      },
      topCards: priceArray.slice(0, 10).map(p => ({
        name: p.name,
        quantity: 1,
        price: p.usd || 0,
        totalValue: p.usd || 0,
      })),
      recentPrices: priceArray.slice(0, 20).map(p => ({
        name: p.name,
        price: p.usd || 0,
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
