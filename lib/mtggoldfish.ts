import * as cheerio from 'cheerio';
import { parseCollection } from './parse-collection';

export interface MetaDeck {
  id: string;
  name: string;
  archetype: string;
  format: 'standard' | 'pioneer' | 'modern';
  metaShare: number; // percentage
  cards: Map<string, number>; // name → quantity
}

const FORMATS = ['standard', 'pioneer', 'modern'] as const;
type Format = (typeof FORMATS)[number];

async function fetchMetaPage(format: Format): Promise<string> {
  const url = `https://www.mtggoldfish.com/metagame/${format}/full`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MTGDeckBuilder/1.0)' },
    cache: 'force-cache',
  });
  if (!res.ok) throw new Error(`MTGGoldfish ${format} fetch failed: ${res.status}`);
  return res.text();
}

async function fetchDeckList(deckId: string): Promise<Map<string, number>> {
  const url = `https://www.mtggoldfish.com/deck/download/${deckId}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MTGDeckBuilder/1.0)' },
    cache: 'force-cache',
  });
  if (!res.ok) return new Map();
  const text = await res.text();
  return parseCollection(text);
}

function parseDeckId(href: string): string | null {
  const m = href.match(/\/deck\/(\d+)/);
  return m ? m[1] : null;
}

export async function fetchTopDecks(format: Format = 'standard', limit = 20): Promise<MetaDeck[]> {
  let html: string;
  try {
    html = await fetchMetaPage(format);
  } catch {
    return [];
  }

  const $ = cheerio.load(html);
  const decks: Omit<MetaDeck, 'cards'>[] = [];

  // MTGGoldfish metagame page: each deck is in a .archetype-tile
  $('.archetype-tile').each((_, el) => {
    if (decks.length >= limit) return false;

    const nameEl = $(el).find('.archetype-tile-title a');
    const name = nameEl.text().trim();
    const href = nameEl.attr('href') ?? '';
    const id = parseDeckId(href);
    if (!name || !id) return;

    const shareText = $(el).find('.percentage').first().text().replace('%', '').trim();
    const metaShare = parseFloat(shareText) || 0;

    decks.push({ id, name, archetype: name, format, metaShare });
  });

  // Fetch deck lists in parallel (batches of 5 to be polite)
  const result: MetaDeck[] = [];
  for (let i = 0; i < decks.length; i += 5) {
    const batch = decks.slice(i, i + 5);
    const lists = await Promise.all(batch.map((d) => fetchDeckList(d.id)));
    for (let j = 0; j < batch.length; j++) {
      if (lists[j].size > 0) {
        result.push({ ...batch[j], cards: lists[j] });
      }
    }
    if (i + 5 < decks.length) await new Promise((r) => setTimeout(r, 200));
  }

  return result;
}
