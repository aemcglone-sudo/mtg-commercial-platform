/**
 * Fetches top metagame decks from MTGTop8.com.
 * Results are cached in memory for 1 hour so repeat loads are instant.
 */

import { parseCollection } from './parse-collection';

export interface MetaDeck {
  id: string;
  name: string;
  format: 'Standard' | 'Pioneer';
  cards: Map<string, number>;
}

const FORMAT_CODE = { Standard: 'ST', Pioneer: 'PI' } as const;
type Format = keyof typeof FORMAT_CODE;

const BASE = 'https://mtgtop8.com';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CONCURRENCY = 6; // max parallel requests to MTGTop8

const cache = new Map<string, { decks: MetaDeck[]; ts: number }>();

async function get(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MTGDeckFinder/1.0)' },
  });
  if (!res.ok) throw new Error(`MTGTop8 ${path} → ${res.status}`);
  return res.text();
}

function parseArchetypes(html: string): Array<{ id: string; name: string }> {
  const results: Array<{ id: string; name: string }> = [];
  const re = /archetype\?a=(\d+)[^>]*>([^<]+)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = m[2].trim();
    if (name && !results.find((r) => r.id === m![1])) results.push({ id: m[1], name });
  }
  return results;
}

function parseFirstDeckRef(html: string): string | null {
  const m = html.match(/name=deck_ref\[1\]\s+value=(\d+)/);
  return m ? m[1] : null;
}

/** Fetch one archetype's deck list in a single pipeline (page → download) */
async function fetchArchetypeDeck(
  arch: { id: string; name: string },
  fc: string,
  format: Format
): Promise<MetaDeck | null> {
  try {
    const html = await get(`/archetype?a=${arch.id}&f=${fc}`);
    const ref = parseFirstDeckRef(html);
    if (!ref) return null;
    const text = await get(`/mtgo?d=${ref}&f=${fc}`);
    const cards = parseCollection(text);
    if (cards.size === 0) return null;
    return { id: `${fc.toLowerCase()}-${arch.id}`, name: arch.name, format, cards };
  } catch {
    return null;
  }
}

/** Run tasks with a max concurrency limit */
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export async function fetchTopDecks(format: Format, limit = 10): Promise<MetaDeck[]> {
  const key = `${format}-${limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.decks;

  const fc = FORMAT_CODE[format];
  let formatHtml: string;
  try {
    formatHtml = await get(`/format?f=${fc}`);
  } catch {
    return cached?.decks ?? [];
  }

  const archetypes = parseArchetypes(formatHtml).slice(0, limit);
  const tasks = archetypes.map((arch) => () => fetchArchetypeDeck(arch, fc, format));
  const raw = await withConcurrency(tasks, CONCURRENCY);
  const decks = raw.filter((d): d is MetaDeck => d !== null);

  cache.set(key, { decks, ts: Date.now() });
  return decks;
}
