import { findMany, findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';

const TAVILY_DOMAINS = ['magic.wizards.com', 'mtggoldfish.com', 'edhrec.com', 'reddit.com', 'starcitygames.com'];
const CACHE_TTL_HOURS = 24 * 7; // news doesn't need daily refresh — same TTL spirit as format_legality_cache
const MAX_LOOKUPS_PER_RUN = 20; // keeps each cron run's news phase bounded; stale-but-cached cards catch up over subsequent days

export interface CardNewsResult {
  hasNews: boolean;
  summary: string | null;
  category: string | null;
  sourceUrls: string[];
  confidence: number | null;
}

/**
 * Real, cited "why" for a card — Tavily search restricted to trusted MTG
 * sources, extracted into a short summary by Gemini. Same pattern as
 * app/api/deck-wizard/ban-list/[format]/route.ts's ban-list lookup, applied
 * to cards instead of formats. Deliberately conservative: only reports
 * something the search results actually said, never speculates.
 */
async function fetchCardNewsFromTavily(cardName: string): Promise<CardNewsResult> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return { hasNews: false, summary: null, category: null, sourceUrls: [], confidence: null };

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `"${cardName}" magic the gathering price reprint banned tournament news ${new Date().getFullYear()}`,
        search_depth: 'advanced',
        include_domains: TAVILY_DOMAINS,
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!res.ok) return { hasNews: false, summary: null, category: null, sourceUrls: [], confidence: null };

    const data = await res.json() as { results: Array<{ url: string; content: string }>; answer?: string };
    if (!data.results || data.results.length === 0) {
      return { hasNews: false, summary: null, category: null, sourceUrls: [], confidence: null };
    }

    if (!process.env.GOOGLE_API_KEY) {
      return { hasNews: false, summary: null, category: null, sourceUrls: data.results.map(r => r.url), confidence: null };
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Here are web search results about the Magic: The Gathering card "${cardName}":

${data.results.map(r => `- ${r.content}`).join('\n')}
${data.answer ? `\nSummary: ${data.answer}` : ''}

Is there a SPECIFIC, concrete, recent reason this card's price might be moving — a reprint announcement, a ban/unban, a strong tournament result, or new set support/synergy? Only report something explicitly stated in the results above. Do not guess or speculate.

Return ONLY valid JSON (no markdown, no code fences):
{
  "hasNews": true or false,
  "summary": "one plain sentence, or null if hasNews is false",
  "category": "reprint" | "banned" | "tournament" | "set_synergy" | "other" | null,
  "confidence": 0.0 to 1.0
}`,
            }],
          }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    if (!geminiRes.ok) {
      return { hasNews: false, summary: null, category: null, sourceUrls: data.results.map(r => r.url), confidence: null };
    }
    const geminiData = await geminiRes.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = JSON.parse(text) as { hasNews?: boolean; summary?: string | null; category?: string | null; confidence?: number };

    return {
      hasNews: parsed.hasNews ?? false,
      summary: parsed.summary ?? null,
      category: parsed.category ?? null,
      sourceUrls: data.results.map(r => r.url),
      confidence: parsed.confidence ?? null,
    };
  } catch (e) {
    console.error(`Card news lookup failed for ${cardName}:`, e);
    return { hasNews: false, summary: null, category: null, sourceUrls: [], confidence: null };
  }
}

export async function getCardNews(scryfallId: string): Promise<(CardNewsResult & { fetchedAt: string }) | null> {
  const rows = await findMany<any>(
    `SELECT has_news as "hasNews", summary, category, source_urls as "sourceUrls", confidence, fetched_at as "fetchedAt"
     FROM market_card_news WHERE scryfall_id = ?`,
    [scryfallId]
  );
  if (rows.length === 0) return null;
  return { ...rows[0], sourceUrls: rows[0].sourceUrls ?? [] };
}

async function upsertCardNews(scryfallId: string, cardName: string, result: CardNewsResult): Promise<void> {
  await run(
    `INSERT INTO market_card_news (scryfall_id, card_name, has_news, summary, category, source_urls, confidence, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, now())
     ON CONFLICT (scryfall_id) DO UPDATE SET
       card_name = EXCLUDED.card_name, has_news = EXCLUDED.has_news, summary = EXCLUDED.summary,
       category = EXCLUDED.category, source_urls = EXCLUDED.source_urls, confidence = EXCLUDED.confidence, fetched_at = now()`,
    [scryfallId, cardName, result.hasNews, result.summary, result.category, result.sourceUrls as any, result.confidence]
  );
}

export interface CardEvent {
  id: string;
  category: string;
  summary: string;
  sourceUrls: string[];
  confidence: number | null;
  priceAtDetection: number | null;
  detectedAt: string;
}

export async function getCardEvents(scryfallId: string): Promise<CardEvent[]> {
  return findMany<CardEvent>(
    `SELECT id, category, summary, source_urls as "sourceUrls", confidence,
            price_at_detection as "priceAtDetection", detected_at as "detectedAt"
     FROM market_card_events WHERE scryfall_id = ? ORDER BY detected_at DESC`,
    [scryfallId]
  );
}

export interface SetEvent extends CardEvent { scryfallId: string; cardName: string }

/** Any logged event for a card that's a printing in this set — powers the
 * set detail panel's "news" section. market_card_events only ever gets
 * populated for watchlist + top-mover cards (see refreshCardNews), so most
 * sets will legitimately show none yet — that's an honest empty state,
 * not a bug. */
export async function getSetEvents(setCode: string, limit = 5): Promise<SetEvent[]> {
  return findMany<SetEvent>(
    `SELECT e.id, e.scryfall_id as "scryfallId", e.card_name as "cardName", e.category, e.summary,
            e.source_urls as "sourceUrls", e.confidence, e.price_at_detection as "priceAtDetection", e.detected_at as "detectedAt"
     FROM market_card_events e
     WHERE e.scryfall_id IN (SELECT DISTINCT scryfall_id FROM market_price_snapshots WHERE set_code = ?)
     ORDER BY e.detected_at DESC
     LIMIT ?`,
    [setCode, limit]
  );
}

/**
 * market_card_news (above) is a single-row "what to show right now" cache —
 * every weekly refresh overwrites it, so it can't answer "what happened to
 * this card's price historically" or support backtesting an event-driven
 * prediction later. This appends a durable row instead, but only when the
 * detected news is actually new: without the dedup check, re-finding the
 * same still-current reprint announcement every CACHE_TTL_HOURS refresh
 * would silently pile up duplicate "events" forever.
 */
async function recordEventIfNew(scryfallId: string, cardName: string, result: CardNewsResult): Promise<void> {
  if (!result.hasNews || !result.summary || !result.category) return;

  const latest = await findOne<{ summary: string }>(
    `SELECT summary FROM market_card_events WHERE scryfall_id = ? ORDER BY detected_at DESC LIMIT 1`,
    [scryfallId]
  );
  if (latest?.summary === result.summary) return; // same event we already logged

  const priceRow = await findOne<{ currentPrice: number | null }>(
    `SELECT current_price as "currentPrice" FROM market_signals WHERE scryfall_id = ? ORDER BY date DESC LIMIT 1`,
    [scryfallId]
  );

  await run(
    `INSERT INTO market_card_events (id, scryfall_id, card_name, category, summary, source_urls, confidence, price_at_detection, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, now())`,
    [randomUUID(), scryfallId, cardName, result.category, result.summary, result.sourceUrls as any, result.confidence, priceRow?.currentPrice ?? null]
  );
}

interface CandidateCard { scryfallId: string; cardName: string; }

/** Watchlist cards + that day's top 7d movers (both directions) — not the
 * full tracked set, to keep API cost/time bounded. See file header. */
async function getCandidateCards(): Promise<CandidateCard[]> {
  const watchlisted = await findMany<CandidateCard>(
    `SELECT DISTINCT scryfall_id as "scryfallId", card_name as "cardName"
     FROM market_watchlist_items WHERE kind = 'card' AND scryfall_id IS NOT NULL AND card_name IS NOT NULL`
  );

  const moversRow = await findOne<{ payload: any }>(
    `SELECT payload FROM market_movers_cache WHERE cache_key = 'card:7'`
  );
  const movers: CandidateCard[] = [];
  if (moversRow?.payload) {
    for (const m of [...(moversRow.payload.gainers ?? []), ...(moversRow.payload.losers ?? [])]) {
      if (m.scryfallId && m.cardName) movers.push({ scryfallId: m.scryfallId, cardName: m.cardName });
    }
  }

  const seen = new Set<string>();
  const combined: CandidateCard[] = [];
  for (const c of [...watchlisted, ...movers]) {
    if (!seen.has(c.scryfallId)) { seen.add(c.scryfallId); combined.push(c); }
  }
  return combined;
}

export interface NewsRefreshResult { candidates: number; fetched: number; skippedFresh: number; }

/** Called from the daily cron, after predictions. Skips anything already
 * fetched within CACHE_TTL_HOURS, and caps how many fresh lookups it makes
 * in one run — the rest catch up on subsequent days. */
export async function refreshCardNews(): Promise<NewsRefreshResult> {
  const candidates = await getCandidateCards();
  let fetched = 0, skippedFresh = 0;

  for (const c of candidates) {
    if (fetched >= MAX_LOOKUPS_PER_RUN) break;

    const existing = await getCardNews(c.scryfallId);
    if (existing && (Date.now() - new Date(existing.fetchedAt).getTime()) < CACHE_TTL_HOURS * 3600 * 1000) {
      skippedFresh++;
      continue;
    }

    const result = await fetchCardNewsFromTavily(c.cardName);
    await upsertCardNews(c.scryfallId, c.cardName, result);
    await recordEventIfNew(c.scryfallId, c.cardName, result);
    fetched++;
    await new Promise(r => setTimeout(r, 500)); // rate limit, matching the existing card-sentiment route's pattern
  }

  return { candidates: candidates.length, fetched, skippedFresh };
}
