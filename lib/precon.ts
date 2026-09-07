import { findMany, run, withTimeout } from '@/lib/db';
import { randomUUID } from 'crypto';

const USER_AGENT = 'MTGDeckBuilder/1.0 (+https://mtgdeckfinder.com)';

async function query<T = any>(sql: string, args: any[], timeoutMs = 15000): Promise<T[]> {
  return withTimeout(timeoutMs, async (q) => (await q(sql, args)).rows as T[]);
}

interface MtgJsonDeckListEntry { code: string; fileName: string; name: string; releaseDate: string; type: string }
interface MtgJsonCard {
  name: string; count: number; isFoil?: boolean; finishes?: string[];
  identifiers: { scryfallId?: string };
}
interface MtgJsonDeck {
  code: string; name: string; releaseDate: string;
  commander?: MtgJsonCard[]; mainBoard: MtgJsonCard[];
}

/** One-time (or occasional, when new precons release) ingestion of every
 * official precon Commander deck PRODUCT ever released — e.g. "Fallout:
 * Scrappy Survivors" — sourced from MTGJSON, since Scryfall has no
 * concept of "which precon a card belongs to" (a release like Fallout
 * Commander is one shared set code across all 4 decks in it). NOT part
 * of the daily cron: decklists are static once printed; only the pricing
 * (refreshPreconValueCache) needs to run daily. Idempotent — safe to
 * re-run to pick up newly-released precons. */
export async function refreshPreconCatalog(): Promise<{ productsUpserted: number; cardsUpserted: number }> {
  const listRes = await fetch('https://mtgjson.com/api/v5/DeckList.json', { headers: { 'User-Agent': USER_AGENT } });
  if (!listRes.ok) throw new Error(`DeckList fetch failed: ${listRes.status}`);
  const listData = await listRes.json();
  const commanderDecks: MtgJsonDeckListEntry[] = (listData.data ?? []).filter((d: MtgJsonDeckListEntry) => d.type === 'Commander Deck');

  let productsUpserted = 0, cardsUpserted = 0;
  for (const entry of commanderDecks) {
    const deckRes = await fetch(`https://mtgjson.com/api/v5/decks/${entry.fileName}.json`, { headers: { 'User-Agent': USER_AGENT } });
    if (!deckRes.ok) continue;
    const deck: MtgJsonDeck = (await deckRes.json()).data;

    const commanderName = deck.commander?.[0]?.name ?? null;
    const productId = randomUUID();
    const existing = await query<{ id: string }>(`SELECT id FROM precon_products WHERE name = ? AND set_code = ?`, [entry.name, entry.code]);
    const id = existing[0]?.id ?? productId;

    await run(
      `INSERT INTO precon_products (id, name, set_code, commander, release_date)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (name, set_code) DO UPDATE SET commander = EXCLUDED.commander, release_date = EXCLUDED.release_date`,
      [id, entry.name, entry.code, commanderName, entry.releaseDate]
    );
    productsUpserted++;

    const allCards = [...(deck.commander ?? []), ...(deck.mainBoard ?? [])];
    for (const card of allCards) {
      const scryfallId = card.identifiers?.scryfallId;
      if (!scryfallId) continue;
      const foilOnly = card.finishes ? card.finishes.includes('foil') && !card.finishes.includes('nonfoil') : !!card.isFoil;
      await run(
        `INSERT INTO precon_product_cards (id, product_id, scryfall_id, card_name, qty, foil_only)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (product_id, scryfall_id) DO UPDATE SET qty = EXCLUDED.qty, card_name = EXCLUDED.card_name, foil_only = EXCLUDED.foil_only`,
        [randomUUID(), id, scryfallId, card.name, card.count ?? 1, foilOnly]
      );
      cardsUpserted++;
    }
  }

  return { productsUpserted, cardsUpserted };
}

export interface PreconCardValue { scryfallId: string; cardName: string; qty: number; foilOnly: boolean; unitPrice: number | null; lineValue: number | null }
export interface PreconValue {
  productId: string; productName: string; setCode: string; commander: string | null;
  totalValue: number; cardCount: number; cardsMatched: number; cards: PreconCardValue[];
}
export interface PreconValueSummary { productId: string; productName: string; setCode: string; commander: string | null; totalValue: number; cardCount: number; cardsMatched: number }

/** Sum-of-singles value for a precon product, using each card's EXACT
 * printing (real scryfall_id from the catalog, not a name-based cheapest-
 * printing guess like the custom deck tracker needs) — foil-aware via the
 * ingested foil_only flag. This is "what would these specific cards cost
 * individually," not the sealed box's actual resale price, which can
 * trade above or below that for convenience/collector demand — we have
 * no real sealed-product price source (see the conversation this was
 * scoped in). */
async function computePreconValue(productId: string, productName: string, setCode: string, commander: string | null): Promise<PreconValue> {
  const cardRows = await query<{ scryfallId: string; cardName: string; qty: number; foilOnly: boolean }>(
    `SELECT scryfall_id as "scryfallId", card_name as "cardName", qty, foil_only as "foilOnly" FROM precon_product_cards WHERE product_id = ?`,
    [productId]
  );
  const scryfallIds = cardRows.map(c => c.scryfallId);
  const priceRows = scryfallIds.length > 0
    ? await query<{ scryfallId: string; usd: string | null; usdFoil: string | null }>(
        `SELECT DISTINCT ON (scryfall_id) scryfall_id as "scryfallId", usd, usd_foil as "usdFoil"
         FROM market_price_snapshots
         WHERE scryfall_id = ANY(?) AND (usd IS NOT NULL OR usd_foil IS NOT NULL)
         ORDER BY scryfall_id, price_date DESC`,
        [scryfallIds]
      )
    : [];
  const priceById = new Map(priceRows.map(r => [r.scryfallId, r]));

  const cards: PreconCardValue[] = cardRows.map(c => {
    const price = priceById.get(c.scryfallId);
    const usd = price?.usd !== null && price?.usd !== undefined ? Number(price.usd) : null;
    const usdFoil = price?.usdFoil !== null && price?.usdFoil !== undefined ? Number(price.usdFoil) : null;
    const unitPrice = c.foilOnly ? (usdFoil !== null && usdFoil > 0 ? usdFoil : usd) : usd;
    return { ...c, unitPrice, lineValue: unitPrice !== null ? unitPrice * c.qty : null };
  });
  const totalValue = cards.reduce((a, c) => a + (c.lineValue ?? 0), 0);
  const cardsMatched = cards.filter(c => c.unitPrice !== null).length;

  return { productId, productName, setCode, commander, totalValue, cardCount: cards.length, cardsMatched, cards };
}

/** Refreshes pricing for every ingested precon product — run daily from
 * the cron (the catalog itself is static; only prices change). */
export async function refreshPreconValueCache(): Promise<{ productsRefreshed: number }> {
  const products = await findMany<{ id: string; name: string; setCode: string; commander: string | null }>(
    `SELECT id, name, set_code as "setCode", commander FROM precon_products`
  );

  const summaries: PreconValueSummary[] = [];
  for (const p of products) {
    const value = await computePreconValue(p.id, p.name, p.setCode, p.commander);
    await run(
      `INSERT INTO market_movers_cache (id, cache_key, payload, computed_at)
       VALUES (?, ?, ?, now())
       ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
      [randomUUID(), `precon_value:${p.id}`, JSON.stringify(value)]
    );
    summaries.push({ productId: value.productId, productName: value.productName, setCode: value.setCode, commander: value.commander, totalValue: value.totalValue, cardCount: value.cardCount, cardsMatched: value.cardsMatched });
  }

  await run(
    `INSERT INTO market_movers_cache (id, cache_key, payload, computed_at)
     VALUES (?, ?, ?, now())
     ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [randomUUID(), 'precon_value_summary', JSON.stringify({ products: summaries.sort((a, b) => b.totalValue - a.totalValue) })]
  );

  return { productsRefreshed: summaries.length };
}

export async function getCachedPreconValueSummary(): Promise<{ products: PreconValueSummary[]; computedAt: string | null }> {
  const row = await findMany<{ payload: { products: PreconValueSummary[] }; computed_at: string }>(
    `SELECT payload, computed_at FROM market_movers_cache WHERE cache_key = 'precon_value_summary'`
  );
  if (row.length === 0) return { products: [], computedAt: null };
  return { products: row[0].payload.products ?? [], computedAt: row[0].computed_at };
}

export async function getCachedPreconValue(productId: string): Promise<{ value: PreconValue | null; computedAt: string | null }> {
  const row = await findMany<{ payload: PreconValue; computed_at: string }>(
    `SELECT payload, computed_at FROM market_movers_cache WHERE cache_key = ?`,
    [`precon_value:${productId}`]
  );
  if (row.length === 0) return { value: null, computedAt: null };
  return { value: row[0].payload, computedAt: row[0].computed_at };
}
