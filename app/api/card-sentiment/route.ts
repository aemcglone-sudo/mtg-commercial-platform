import { NextRequest, NextResponse } from 'next/server';

interface TavilyResult {
  title: string;
  content: string;
  url: string;
}

interface SentimentScore {
  card: string;
  score: number;
  query: string;
  sources: string;
}

/**
 * Fetch community sentiment about a Magic card using Tavily search
 * Returns a "fearedness" score based on what people say about it
 */
export async function POST(req: NextRequest) {
  try {
    const { cards } = await req.json() as { cards: string[] };

    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json({ error: 'Tavily API key not configured' }, { status: 500 });
    }

    const results: SentimentScore[] = [];

    for (const cardName of cards) {
      try {
        // Search for what people say about this card
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: `"${cardName}" magic the gathering is it good powerful`,
            max_results: 5,
            include_domains: ['edhrec.com', 'scryfall.com', 'reddit.com/r/magicTCG', 'reddit.com/r/EDH'],
          }),
        });

        if (!tavilyRes.ok) {
          console.warn(`Tavily search failed for ${cardName}`);
          results.push({ card: cardName, score: 0, query: '', sources: '' });
          continue;
        }

        const data = await tavilyRes.json() as any;
        const searchResults = data.results as TavilyResult[];

        // Analyze results for sentiment keywords
        let score = 0;
        const sources: string[] = [];

        for (const result of searchResults) {
          const text = (result.title + ' ' + result.content).toLowerCase();
          sources.push(result.title);

          // Look for positive sentiment keywords
          if (text.includes('best') || text.includes('format staple')) score += 25;
          if (text.includes('broken') || text.includes('overpowered')) score += 30;
          if (text.includes('meta') || text.includes('competitive')) score += 15;
          if (text.includes('powerful') || text.includes('strong')) score += 15;
          if (text.includes('must have') || text.includes('essential')) score += 25;
          if (text.includes('banned') || text.includes('too strong')) score += 20;
          if (text.includes('combo') || text.includes('synergy')) score += 10;
          if (text.includes('feared') || text.includes('feared in')) score += 25;
          if (text.includes('dominates') || text.includes('dominates format')) score += 20;
          if (text.includes('tier 1') || text.includes('top tier')) score += 20;

          // Negative sentiment
          if (text.includes('bad') || text.includes('weak')) score -= 10;
          if (text.includes('overrated')) score -= 5;
        }

        // Cap score at 100 and ensure it's not negative
        score = Math.max(0, Math.min(100, score));

        results.push({
          card: cardName,
          score,
          query: `"${cardName}" magic the gathering`,
          sources: sources.slice(0, 3).join(' | '),
        });

        // Rate limit Tavily requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error analyzing ${cardName}:`, error);
        results.push({ card: cardName, score: 0, query: '', sources: 'Error fetching' });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Card sentiment error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
