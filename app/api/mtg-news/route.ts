import { NextResponse } from 'next/server';

export const maxDuration = 60;

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function GET() {
  const cacheKey = 'mtg-news';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const [articles, upcoming, videos] = await Promise.all([
      searchMTGNews(),
      getUpcomingReleases(),
      searchMTGVideos(),
    ]);

    const result = { articles, upcoming, videos };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    console.error('MTG news fetch error:', err);
    return NextResponse.json({ articles: [], upcoming: [], videos: [], error: 'Failed to fetch news' }, { status: 500 });
  }
}

async function searchMTGNews() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return getDefaultNews();

  try {
    const queries = [
      'Magic The Gathering official news',
      '"Magic: The Gathering" latest news -pokemon',
      'MTG card spoilers announcements',
    ];

    for (const query of queries) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, query, max_results: 15, include_answer: false, topic: 'news' }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const valid = (data.results ?? []).filter((r: any) =>
        !r.title.toLowerCase().includes('pokemon') && !r.url.toLowerCase().includes('pokemon')
      );
      if (valid.length > 0) {
        return valid.slice(0, 10).map((r: any) => ({
          title: r.title,
          url: r.url,
          description: r.content ? r.content.substring(0, 150) : '',
          source: new URL(r.url).hostname.replace('www.', ''),
          date: new Date().toLocaleDateString(),
        }));
      }
    }
    return getDefaultNews();
  } catch {
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
  ];
}

async function getUpcomingReleases() {
  try {
    const res = await fetch('https://api.scryfall.com/sets', {
      headers: { 'User-Agent': 'Grimoire/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const INCLUDED_TYPES = new Set(['expansion', 'commander', 'box', 'masters', 'draft_innovation', 'core']);
    return (data.data ?? [])
      .filter((s: any) => s.released_at > today && INCLUDED_TYPES.has(s.set_type))
      .sort((a: any, b: any) => a.released_at.localeCompare(b.released_at))
      .slice(0, 20)
      .map((s: any) => ({
        name: s.name,
        code: s.code.toUpperCase(),
        releaseDate: s.released_at,
        setType: s.set_type,
        iconUrl: s.icon_svg_uri ?? null,
        scryfallUri: `https://scryfall.com/sets/${s.code}`,
        cardCount: s.card_count ?? null,
      }));
  } catch {
    return [];
  }
}

async function searchMTGVideos() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

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
    if (!res.ok) return [];
    const data = await res.json();
    const seenIds = new Set<string>();
    return (data.results ?? [])
      .map((r: any) => {
        const m = r.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (!m) return null;
        if (seenIds.has(m[1])) return null;
        seenIds.add(m[1]);
        const title = r.title || 'MTG Video';
        const channelMatch = title.match(/^(.+?)\s*[-–|:]/);
        return {
          id: m[1],
          title: title.replace(/^.+?[-–|:]\s*/, '').substring(0, 80),
          channel: channelMatch ? channelMatch[1].trim() : 'MTG Creator',
          thumbnail: `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`,
        };
      })
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}
