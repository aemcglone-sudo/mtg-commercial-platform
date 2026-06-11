import { NextRequest, NextResponse } from 'next/server';

interface ExpensiveCard {
  name: string;
  price: number;
  set: string;
}

/**
 * Fetch most expensive Magic cards - returns well-known expensive cards
 */
export async function GET(req: NextRequest) {
  try {
    // Mock data for now - can be replaced with real Scryfall fetches later
    const expensiveCards: ExpensiveCard[] = [
      { name: 'Charizard (Holographic)', price: 250000, set: 'Base Set' },
      { name: 'Black Lotus', price: 10000, set: 'Limited Edition Alpha' },
      { name: 'Ancestral Recall', price: 8500, set: 'Limited Edition Alpha' },
      { name: 'Time Walk', price: 7200, set: 'Limited Edition Alpha' },
      { name: 'Mox Pearl', price: 6800, set: 'Limited Edition Alpha' },
      { name: 'Mox Jet', price: 6500, set: 'Limited Edition Alpha' },
      { name: 'Mox Sapphire', price: 6200, set: 'Limited Edition Alpha' },
      { name: 'Mox Brass', price: 5900, set: 'Limited Edition Alpha' },
      { name: 'Mox Ruby', price: 5600, set: 'Limited Edition Alpha' },
      { name: 'Mox Emerald', price: 5300, set: 'Limited Edition Alpha' },
    ];

    return NextResponse.json({ cards: expensiveCards });
  } catch (error) {
    console.error('Expensive cards error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
