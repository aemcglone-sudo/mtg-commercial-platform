/**
 * Event sync — runs daily (3am ET on Fly.io).
 * Three passes:
 *   1. Wizards Event Locator (sanctioned events)
 *   2. Tavily scraping for store websites
 *   3. (cleanup handled by cleanup-stale-events.ts)
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
// Inline AI call to avoid ESM module resolution issues with ts-node
async function claudeExtract(prompt: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, temperature: 0.2,
        messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    return data.content?.find(b => b.type === 'text')?.text ?? null;
  } catch { return null; }
}

function extractJson(text: string): string {
  const m = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/\{[\s\S]*\}/) ?? text.match(/\[[\s\S]*\]/);
  return m ? (m[1] ?? m[0]) : text;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PILOT_LAT = 33.749;
const PILOT_LNG = -84.388;

type WizardsEventType = string;

function mapWizardsEventType(type: WizardsEventType): string {
  const map: Record<string, string> = {
    FNM: 'FNM',
    PRERELEASE: 'prerelease',
    PTQ: 'tournament',
    STORE_CHAMPIONSHIP: 'tournament',
    GAME_DAY: 'tournament',
    COMMANDER: 'commander_night',
    DRAFT: 'draft',
    SEALED: 'sealed',
  };
  return map[type?.toUpperCase()] ?? 'other';
}

interface WizardsStore {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  events?: Array<{
    id: string;
    name: string;
    type: string;
    format?: string;
    startDate?: string;
    startTime?: string;
  }>;
}

async function syncWizardsEvents() {
  // Wizards Event Locator moved to a private GraphQL API requiring auth.
  // Tavily scraping covers event discovery for now.
  console.log('[Wizards] API requires auth — skipped');
}

interface TavilyResult {
  url: string;
  content: string;
  title?: string;
}

interface ExtractedEvent {
  title: string;
  event_type: string;
  format?: string;
  day_of_week?: string;
  specific_date?: string;
  time: string;
  entry_fee?: string;
  notes?: string;
  confidence: number;
}

interface ExtractionResult {
  events: ExtractedEvent[];
  source_url?: string;
}

async function extractEventsWithKhoa(storeName: string, results: TavilyResult[]): Promise<ExtractionResult> {
  const text = results.map(r => `URL: ${r.url}\n${r.content}`).join('\n\n---\n\n').slice(0, 3000);
  const prompt = `Extract upcoming MTG events from this text about ${storeName}.
Return JSON only:
{
  "events": [
    {
      "title": "Friday Night Magic",
      "event_type": "FNM",
      "format": "Standard",
      "day_of_week": "Friday",
      "specific_date": null,
      "time": "6:30 PM",
      "entry_fee": "$5",
      "notes": "Prizes for top 4",
      "confidence": 0.9
    }
  ],
  "source_url": "https://..."
}
event_type values: FNM | prerelease | commander_night | draft | sealed | tournament | casual | other
If no events found, return { "events": [] }.
Only include events with confidence >= 0.7.

Text to analyze:
${text}`;

  const response = await claudeExtract(prompt);
  if (!response) return { events: [] };
  try {
    return JSON.parse(extractJson(response)) as ExtractionResult;
  } catch {
    return { events: [] };
  }
}

async function scrapeTavilyEvents() {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) { console.warn('[Tavily] No TAVILY_API_KEY — skipping'); return; }

  const { rows: stores } = await pool.query<{
    id: string; name: string; website_url: string; last_synced_at: string;
  }>(
    `SELECT id, name, website_url, last_synced_at FROM discovered_stores
     WHERE website_url IS NOT NULL AND is_active = true
     ORDER BY last_synced_at ASC NULLS FIRST`
  );

  console.log(`[Tavily] Scraping ${stores.length} stores with websites...`);
  let scraped = 0;

  for (const store of stores) {
    // Don't re-scrape within 24 hours (pass --force to override)
    const force = process.argv.includes('--force');
    if (!force && store.last_synced_at) {
      const age = Date.now() - new Date(store.last_synced_at).getTime();
      if (age < 24 * 60 * 60 * 1000) continue;
    }

    try {
      let domain = '';
      try { domain = new URL(store.website_url).hostname; } catch { continue; }

      const searchQuery = `${store.name} MTG events schedule game night Commander FNM 2026`;
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: searchQuery,
          search_depth: 'advanced',
          include_domains: [domain],
          max_results: 3,
        }),
      });

      let results: TavilyResult[] = [];
      if (res.ok) {
        const data = await res.json() as { results?: TavilyResult[] };
        results = data.results ?? [];
      }

      // Fallback to broader search if no results from domain
      if (!results.length) {
        const fallbackRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: `"${store.name}" Magic the Gathering events Atlanta 2026`,
            search_depth: 'basic',
            max_results: 5,
          }),
        });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json() as { results?: TavilyResult[] };
          results = data.results ?? [];
        }
      }

      if (!results.length) continue;

      const extracted = await extractEventsWithKhoa(store.name, results);

      for (const event of extracted.events) {
        if (event.confidence < 0.7) continue;

        // Don't duplicate events already found by Wizards locator for same store/type/day
        const { rows: existing } = await pool.query(
          `SELECT id FROM local_events
           WHERE discovered_store_id = $1 AND event_type = $2
             AND (day_of_week = $3 OR day_of_week IS NULL)
             AND source = 'wizards_locator'`,
          [store.id, event.event_type, event.day_of_week ?? null]
        );
        if (existing.length) continue;

        await pool.query(
          `INSERT INTO local_events
            (id, discovered_store_id, title, event_type, format, is_recurring,
             day_of_week, specific_date, time_of_day, entry_fee, notes, source,
             source_url, scrape_confidence, last_confirmed_at, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),true)
           ON CONFLICT DO NOTHING`,
          [
            randomUUID(), store.id, event.title, event.event_type, event.format ?? null,
            !!event.day_of_week, event.day_of_week ?? null,
            event.specific_date ? new Date(event.specific_date) : null,
            event.time ?? null, event.entry_fee ?? null, event.notes ?? null,
            'tavily_scrape', extracted.source_url ?? null, event.confidence,
          ]
        );
      }

      scraped++;
      // Rate limit: 1 req/sec for Tavily
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[Tavily] Error scraping ${store.name}:`, err);
    }
  }

  console.log(`[Tavily] Done. Scraped ${scraped} stores.`);
}

async function main() {
  console.log('[sync-events] Starting...');
  await syncWizardsEvents();
  await scrapeTavilyEvents();
  console.log('[sync-events] All passes complete.');
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
