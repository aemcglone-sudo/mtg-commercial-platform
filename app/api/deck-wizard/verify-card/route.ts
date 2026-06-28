import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardName, format } = await req.json() as { cardName: string; format: string };
  if (!cardName || !format) return NextResponse.json({ error: 'cardName and format required' }, { status: 400 });

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return NextResponse.json({ legal: true, banned: false, reason: 'Verification unavailable', source: null });

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `Is "${cardName}" banned in ${format} Magic The Gathering ${new Date().getFullYear()}`,
        search_depth: 'basic',
        include_domains: ['magic.wizards.com', 'mtggoldfish.com', 'mtgcommander.net'],
        max_results: 3,
        include_answer: true,
      }),
    });

    if (!res.ok) return NextResponse.json({ legal: true, banned: false, reason: null, source: null });
    const data = await res.json() as { results: Array<{ url: string; content: string }>; answer?: string };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Based on these search results, is "${cardName}" currently banned in Magic: The Gathering ${format} format?

${data.answer ? `Answer: ${data.answer}\n\n` : ''}Results: ${data.results.map(r => r.content).slice(0, 2).join('\n\n')}

Return ONLY valid JSON:
{"banned": false, "reason": null, "confidence": 0.9, "source_url": null}

banned: true only if explicitly confirmed banned. reason: brief explanation if banned. confidence: 0-1.`,
            }],
          }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!geminiRes.ok) return NextResponse.json({ legal: true, banned: false, reason: null, source: null });
    const gd = await geminiRes.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
    const parsed = JSON.parse(gd.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') as { banned?: boolean; reason?: string; confidence?: number; source_url?: string };

    return NextResponse.json({
      legal: !parsed.banned,
      banned: parsed.banned ?? false,
      reason: parsed.reason ?? null,
      confidence: parsed.confidence ?? 0.5,
      source: parsed.source_url ?? (data.results[0]?.url ?? null),
    });
  } catch {
    return NextResponse.json({ legal: true, banned: false, reason: null, source: null });
  }
}
