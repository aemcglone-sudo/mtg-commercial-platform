import { NextRequest, NextResponse } from 'next/server';
import { setPrice, storePriceSnapshot } from '@/lib/price-cache';

interface CardPriceData {
  name: string;
  usd?: number;
  usd_foil?: number;
  eur?: number;
}

/**
 * Fetch prices from Scryfall
 */
async function fetchScryfallPrices(cardNames: string[]): Promise<CardPriceData[]> {
  const results: CardPriceData[] = [];

  for (const cardName of cardNames) {
    try {
      const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
      if (!response.ok) continue;

      const data = await response.json() as any;
      results.push({
        name: data.name,
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
 * Background job to update card prices daily
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.BACKGROUND_JOB_SECRET || 'secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    // For demo, just fetch a few popular cards
    const populares = [
      'Black Lotus',
      'Sol Ring',
      'Mox Pearl',
      'Lightning Bolt',
      'Counterspell',
      'Ancestral Recall',
      'Time Walk',
      'Jace, the Mind Sculptor',
      'Teferi, Time Raveler',
      'Emrakul, the Aeons Torn',
    ];

    const prices = await fetchScryfallPrices(populares);
    console.log(`Fetched ${prices.length} prices`);

    // Store prices
    for (const price of prices) {
      setPrice(price.name, {
        name: price.name,
        usd: price.usd,
        foil: price.usd_foil,
        lastUpdated: new Date().toISOString(),
      });

      // Store snapshot for history
      storePriceSnapshot(price.name, price.usd, price.usd_foil);
    }

    return NextResponse.json({
      success: true,
      cardsPriced: prices.length,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Price update failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
