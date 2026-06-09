import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function POST(req: NextRequest) {
  const { cardName, searchType } = await req.json();

  if (!cardName) {
    return NextResponse.json({ error: 'Card name required' }, { status: 400 });
  }

  try {
    // Call Tavily API
    const results = await searchCardInfo(cardName, searchType);
    return NextResponse.json({ cardName, results });
  } catch (err) {
    console.error('Card info search error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 }
    );
  }
}

async function searchCardInfo(
  cardName: string,
  searchType?: 'legality' | 'prices' | 'availability' | 'all'
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  // Build search queries based on type
  const queries: string[] = [];

  if (!searchType || searchType === 'all' || searchType === 'legality') {
    queries.push(`${cardName} MTG legality standard pioneer commander modern legacy`);
  }

  if (!searchType || searchType === 'all' || searchType === 'prices') {
    queries.push(`${cardName} magic card price TCGPlayer Cardmarket`);
  }

  if (!searchType || searchType === 'all' || searchType === 'availability') {
    queries.push(`${cardName} magic card in stock buy`);
  }

  const allResults: TavilyResult[] = [];

  for (const query of queries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: 5,
          include_answer: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          allResults.push(...data.results);
        }
      }
    } catch (err) {
      console.error(`Tavily search failed for query "${query}":`, err);
    }
  }

  // Deduplicate results by URL
  const seen = new Set<string>();
  return allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}
