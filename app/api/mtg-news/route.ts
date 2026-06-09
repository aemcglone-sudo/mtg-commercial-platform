import { NextResponse } from 'next/server';

export const maxDuration = 60;

// Cache news for 1 hour to avoid hitting rate limits
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function GET() {
  const cacheKey = 'mtg-news';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const [articles, videos] = await Promise.all([
      searchMTGNews(),
      searchMTGVideos(),
    ]);

    const result = { articles, videos };
    cache.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (err) {
    console.error('MTG news fetch error:', err);
    return NextResponse.json(
      { articles: [], videos: [], error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}

async function searchMTGNews() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('TAVILY_API_KEY not set');
    return getDefaultNews();
  }

  try {
    const searchQueries = [
      'Magic The Gathering official news',
      '"Magic: The Gathering" latest news -pokemon',
      'MTG card spoilers announcements',
    ];

    for (const query of searchQueries) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          max_results: 15,
          include_answer: false,
          topic: 'news',
        }),
      });

      if (!res.ok) {
        console.error('Tavily API error:', res.status, res.statusText);
        continue;
      }

      const data = await res.json();
      console.log(`Tavily search for "${query}" returned ${data.results?.length || 0} results`);

      if (data.results && data.results.length > 0) {
        // Filter out Pokemon results
        const validResults = data.results.filter((r: any) =>
          !r.title.toLowerCase().includes('pokemon') &&
          !r.url.toLowerCase().includes('pokemon')
        );

        if (validResults.length > 0) {
          const articles = validResults
            .slice(0, 10)
            .map((result: any) => ({
              title: result.title,
              url: result.url,
              description: result.content ? result.content.substring(0, 150) : '',
              source: new URL(result.url).hostname.replace('www.', ''),
              date: new Date().toLocaleDateString(),
            }));

          return articles;
        }
      }
    }

    console.warn('No valid MTG news found from Tavily, using defaults');
    return getDefaultNews();
  } catch (err) {
    console.error('Tavily news search error:', err);
    return getDefaultNews();
  }
}

function getDefaultNews() {
  return [
    {
      title: 'Magic: The Gathering Latest Updates',
      url: 'https://magic.wizards.com/en',
      description: 'Check the official Magic: The Gathering website for the latest news and updates.',
      source: 'magic.wizards.com',
      date: new Date().toLocaleDateString(),
    },
    {
      title: 'MTG Arena Updates',
      url: 'https://mtgarena.pro',
      description: 'Stay updated with the latest MTG Arena patch notes and tournament information.',
      source: 'mtgarena.pro',
      date: new Date().toLocaleDateString(),
    },
  ];
}

async function searchMTGVideos() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return getDefaultVideos();
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: 'MTG Magic the Gathering video site:youtube.com deck guide',
        max_results: 8,
        include_answer: false,
      }),
    });

    if (!res.ok) {
      console.error('Tavily video API error:', res.status);
      return getDefaultVideos();
    }

    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      return getDefaultVideos();
    }

    const seenIds = new Set<string>();
    const videos = (data.results || [])
      .map((result: any) => {
        // Extract video ID from YouTube URL
        const urlMatch = result.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (!urlMatch) return null;

        const videoId = urlMatch[1];

        // Deduplicate: skip if we've already seen this video ID
        if (seenIds.has(videoId)) return null;
        seenIds.add(videoId);

        const title = result.title || 'MTG Video';
        // Extract channel name from title or URL
        const channelMatch = title.match(/^(.+?)\s*[-–|:]/);
        const channel = channelMatch ? channelMatch[1].trim() : 'MTG Creator';

        return {
          id: videoId,
          title: title.replace(/^.+?[-–|:]\s*/, '').substring(0, 80), // Remove channel prefix
          channel,
          publishedAt: 'Recently',
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        };
      })
      .filter((v: any) => v !== null)
      .slice(0, 5);

    return videos.length > 0 ? videos : getDefaultVideos();
  } catch (err) {
    console.error('Video search error:', err);
    return getDefaultVideos();
  }
}

function getDefaultVideos() {
  // Return empty array - videos require API to work
  return [];
}
