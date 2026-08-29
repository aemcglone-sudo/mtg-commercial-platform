const BASE = 'https://api.scryfall.com';
const USER_AGENT = 'MTGDeckBuilder/1.0 (+https://mtgdeckfinder.com)';

export interface ScryfallCard {
  id: string;
  name: string;
  type_line?: string;
  colors?: string[];         // ['W','U','B','R','G'] — empty = colorless
  color_identity?: string[];
  cmc?: number;              // converted mana cost / mana value
  rarity?: string;           // 'common' | 'uncommon' | 'rare' | 'mythic'
  oracle_text?: string;      // full card text
  artist?: string;           // card illustrator name
  image_uris?: { small: string; normal: string; large: string };
  card_faces?: Array<{ image_uris?: { small: string; normal: string }; colors?: string[] }>;
  prices: { usd: string | null; usd_foil: string | null };
  scryfall_uri: string;
  set: string;
  set_name: string;
  collector_number: string;
  legalities?: Record<string, 'legal' | 'banned' | 'restricted' | 'not_legal'>; // standard, pioneer, commander, modern, legacy, etc.
}

const cardCache = new Map<string, ScryfallCard | null>();

/** POST to /cards/collection with retry + backoff on 429 (Scryfall rate limit).
 * Without this, a large collection (1000s of cards, 75/batch) reliably hits
 * the rate limit partway through and every remaining batch fails silently,
 * leaving those cards with no price/image at all. */
async function postCollectionWithRetry(identifiers: Array<{ id: string } | { name: string }>): Promise<{ data: ScryfallCard[] } | null> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify({ identifiers }),
      });
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = parseFloat(res.headers.get('retry-after') ?? '');
        const backoffMs = !isNaN(retryAfter) ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 15000);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 15000)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function getCard(name: string): Promise<ScryfallCard | null> {
  if (cardCache.has(name)) return cardCache.get(name)!;

  try {
    const res = await fetch(
      `${BASE}/cards/named?exact=${encodeURIComponent(name)}`,
      { cache: 'force-cache', headers: { 'User-Agent': USER_AGENT } }
    );
    if (!res.ok) {
      cardCache.set(name, null);
      return null;
    }
    const card = (await res.json()) as ScryfallCard;
    cardCache.set(name, card);
    return card;
  } catch {
    cardCache.set(name, null);
    return null;
  }
}

/** Bulk-fetch a list of card names, respecting Scryfall's 75ms rate limit */
export async function getCards(names: string[]): Promise<Map<string, ScryfallCard>> {
  const result = new Map<string, ScryfallCard>();
  const unique = [...new Set(names)];

  // Scryfall collection endpoint: up to 75 cards per request
  for (let i = 0; i < unique.length; i += 75) {
    const chunk = unique.slice(i, i + 75);
    const identifiers = chunk.map((name) => ({ name }));
    const data = await postCollectionWithRetry(identifiers);
    if (data) {
      for (const card of data.data) {
        result.set(card.name, card);
      }
    }
    if (i + 75 < unique.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return result;
}

/** Bulk-fetch cards by exact Scryfall ID — pins down the specific printing rather than
 * letting Scryfall pick an arbitrary default for a name that has multiple prints. */
export async function getCardsByIds(ids: string[]): Promise<Map<string, ScryfallCard>> {
  const result = new Map<string, ScryfallCard>();
  const unique = [...new Set(ids)];

  for (let i = 0; i < unique.length; i += 75) {
    const chunk = unique.slice(i, i + 75);
    const identifiers = chunk.map((id) => ({ id }));
    const data = await postCollectionWithRetry(identifiers);
    if (data) {
      for (const card of data.data) {
        result.set(card.id, card);
      }
    }
    if (i + 75 < unique.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return result;
}

export function cardImageUrl(card: ScryfallCard, size: 'small' | 'normal' | 'large' = 'normal'): string {
  if (card.image_uris) return card.image_uris[size as keyof typeof card.image_uris];
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris[size as 'small' | 'normal'];
  return '';
}

export function cardPrice(card: ScryfallCard, finish?: string | null): number {
  if (finish === 'foil' || finish === 'etched') {
    const foilPrice = parseFloat(card.prices.usd_foil ?? '0') || 0;
    if (foilPrice > 0) return foilPrice;
  }
  return parseFloat(card.prices.usd ?? '0') || 0;
}

export function getCardLegality(card: ScryfallCard, format: string): string | undefined {
  return card.legalities?.[format.toLowerCase()];
}

export function isLegalInFormat(card: ScryfallCard, format: string): boolean {
  const legality = getCardLegality(card, format);
  return legality === 'legal';
}

export function isBannedInFormat(card: ScryfallCard, format: string): boolean {
  const legality = getCardLegality(card, format);
  return legality === 'banned' || legality === 'restricted';
}
