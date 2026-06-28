import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';

const CACHE_TTL_HOURS = 24;

const TAVILY_DOMAINS: Record<string, string[]> = {
  default: ['magic.wizards.com', 'mtggoldfish.com', 'scryfall.com'],
  commander: ['magic.wizards.com', 'mtggoldfish.com', 'mtgcommander.net', 'scryfall.com'],
};

async function fetchBanListFromTavily(format: string): Promise<{ banned: string[]; restricted: string[]; confidence: number; urls: string[] }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { banned: [], restricted: [], confidence: 0, urls: [] };

  const formatLabel = format.charAt(0).toUpperCase() + format.slice(1).replace(/_/g, ' ');
  const domains = TAVILY_DOMAINS[format] ?? TAVILY_DOMAINS.default;

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `Magic The Gathering ${formatLabel} format banned cards list ${new Date().getFullYear()}`,
        search_depth: 'advanced',
        include_domains: domains,
        max_results: 5,
        include_answer: true,
      }),
    });

    if (!res.ok) return { banned: [], restricted: [], confidence: 0, urls: [] };
    const data = await res.json() as { results: Array<{ url: string; content: string }>; answer?: string };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Extract the current ban list for Magic: The Gathering ${formatLabel} format from these search results.

Search results:
${data.results.map(r => r.content).join('\n\n')}
${data.answer ? `\nAnswer: ${data.answer}` : ''}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "banned": ["Card Name 1", "Card Name 2"],
  "restricted": ["Card Name 3"],
  "confidence": 0.95
}

"restricted" is only applicable to Vintage format (max 1 copy allowed). For all other formats, restricted should be empty.
Only include cards explicitly mentioned as banned or restricted. Do not guess.`,
            }],
          }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!geminiRes.ok) return { banned: [], restricted: [], confidence: 0.5, urls: data.results.map(r => r.url) };
    const geminiData = await geminiRes.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = JSON.parse(text) as { banned?: string[]; restricted?: string[]; confidence?: number };

    return {
      banned: parsed.banned ?? [],
      restricted: parsed.restricted ?? [],
      confidence: parsed.confidence ?? 0.8,
      urls: data.results.map(r => r.url),
    };
  } catch {
    return { banned: [], restricted: [], confidence: 0, urls: [] };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ format: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { format } = await params;
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';

  const cached = await findOne<{ format: string; ban_list: { banned: string[]; restricted: string[] }; fetched_at: string; confidence: number; source_urls: string[] }>(
    `SELECT format, ban_list, fetched_at, confidence, source_urls FROM format_legality_cache WHERE format = ?`,
    [format]
  );

  const isStale = !cached || forceRefresh ||
    (new Date().getTime() - new Date(cached.fetched_at).getTime()) > CACHE_TTL_HOURS * 3600 * 1000;

  if (!isStale && cached) {
    return NextResponse.json({
      format,
      banned: cached.ban_list.banned ?? [],
      restricted: cached.ban_list.restricted ?? [],
      fetchedAt: cached.fetched_at,
      confidence: cached.confidence,
      sourceUrls: cached.source_urls ?? [],
      fromCache: true,
    });
  }

  const result = await fetchBanListFromTavily(format);

  await run(
    `INSERT INTO format_legality_cache (format, ban_list, source_urls, fetched_at, confidence)
     VALUES (?, ?, ?, NOW(), ?)
     ON CONFLICT (format) DO UPDATE SET ban_list = EXCLUDED.ban_list, source_urls = EXCLUDED.source_urls, fetched_at = NOW(), confidence = EXCLUDED.confidence`,
    [format, JSON.stringify({ banned: result.banned, restricted: result.restricted }), result.urls as unknown as string, result.confidence]
  );

  return NextResponse.json({
    format,
    banned: result.banned,
    restricted: result.restricted,
    fetchedAt: new Date().toISOString(),
    confidence: result.confidence,
    sourceUrls: result.urls,
    fromCache: false,
  });
}
