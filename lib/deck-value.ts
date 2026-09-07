import { findMany, run, withTimeout } from '@/lib/db';
import { randomUUID } from 'crypto';

/** Cron-only; lets a failure throw rather than silently caching a wrong
 * total, matching lib/market-index.ts's queryOne. */
async function query<T = any>(sql: string, args: (string | number | string[])[], timeoutMs = 15000): Promise<T[]> {
  return withTimeout(timeoutMs, async (q) => (await q(sql, args as any)).rows as T[]);
}

export interface DeckCardValue { name: string; qty: number; unitPrice: number | null; lineValue: number | null }
export interface DeckValue {
  deckId: string; deckName: string; commander: string | null;
  totalValue: number; cardCount: number; cardsMatched: number;
  cards: DeckCardValue[];
}
export interface DeckValueSummary { deckId: string; deckName: string; commander: string | null; totalValue: number; cardCount: number; cardsMatched: number }

/** Decks store their list as a plain {"Card Name": quantity} JSON object —
 * no scryfall_id, no set (deck_items, the relational link to priced
 * InventoryItem rows, exists in the schema but has zero rows in real
 * data — not usable). A name alone is ambiguous (Sol Ring has 100+
 * printings at wildly different prices — see getPrintings()), so this
 * prices every card at its CHEAPEST currently-tracked printing: a "what
 * would it cost to assemble this deck" estimate, not "what your specific
 * copies are worth" (that's what /portfolio is for, for owned cards with
 * a real scryfall_id link). Measured live at ~760ms for a real 93-card
 * deck, 100% name match. */
async function computeDeckValue(deckId: string, deckName: string, commander: string | null, cardsJson: string): Promise<DeckValue | null> {
  let cardMap: Record<string, number>;
  try {
    cardMap = JSON.parse(cardsJson);
  } catch {
    return null;
  }
  const names = Object.keys(cardMap);
  if (names.length === 0) return null;

  const rows = await query<{ card_name: string; cheapest: string }>(
    `SELECT card_name, MIN(usd) as cheapest
     FROM market_price_snapshots
     WHERE card_name = ANY(?) AND price_date = (SELECT MAX(price_date) FROM market_price_snapshots) AND usd IS NOT NULL
     GROUP BY card_name`,
    [names]
  );
  const priceByName = new Map(rows.map(r => [r.card_name, Number(r.cheapest)]));

  const cards: DeckCardValue[] = Object.entries(cardMap).map(([name, qty]) => {
    const unitPrice = priceByName.get(name) ?? null;
    return { name, qty, unitPrice, lineValue: unitPrice !== null ? unitPrice * qty : null };
  });
  const totalValue = cards.reduce((a, c) => a + (c.lineValue ?? 0), 0);
  const cardsMatched = cards.filter(c => c.unitPrice !== null).length;

  return { deckId, deckName, commander, totalValue, cardCount: cards.length, cardsMatched, cards };
}

/** Every Commander-format deck with a card list — loops and caches each,
 * same pattern as Portfolio. "Commander" is stored inconsistently
 * (mixed case in real data), matched case-insensitively. */
export async function refreshDeckValueCache(): Promise<{ decksRefreshed: number }> {
  const decks = await findMany<{ id: string; name: string; commander: string | null; cards: string | null }>(
    `SELECT id, name, commander, cards FROM decks WHERE format ILIKE 'commander' AND cards IS NOT NULL`
  );

  const summaries: DeckValueSummary[] = [];
  for (const deck of decks) {
    const value = await computeDeckValue(deck.id, deck.name, deck.commander, deck.cards!);
    if (!value) continue;

    await run(
      `INSERT INTO market_movers_cache (id, cache_key, payload, computed_at)
       VALUES (?, ?, ?, now())
       ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
      [randomUUID(), `deck_value:${deck.id}`, JSON.stringify(value)]
    );
    summaries.push({ deckId: value.deckId, deckName: value.deckName, commander: value.commander, totalValue: value.totalValue, cardCount: value.cardCount, cardsMatched: value.cardsMatched });
  }

  await run(
    `INSERT INTO market_movers_cache (id, cache_key, payload, computed_at)
     VALUES (?, ?, ?, now())
     ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [randomUUID(), 'deck_value_summary', JSON.stringify({ decks: summaries.sort((a, b) => b.totalValue - a.totalValue) })]
  );

  return { decksRefreshed: summaries.length };
}

export async function getCachedDeckValueSummary(): Promise<{ decks: DeckValueSummary[]; computedAt: string | null }> {
  const row = await findMany<{ payload: { decks: DeckValueSummary[] }; computed_at: string }>(
    `SELECT payload, computed_at FROM market_movers_cache WHERE cache_key = 'deck_value_summary'`
  );
  if (row.length === 0) return { decks: [], computedAt: null };
  return { decks: row[0].payload.decks ?? [], computedAt: row[0].computed_at };
}

export async function getCachedDeckValue(deckId: string): Promise<{ value: DeckValue | null; computedAt: string | null }> {
  const row = await findMany<{ payload: DeckValue; computed_at: string }>(
    `SELECT payload, computed_at FROM market_movers_cache WHERE cache_key = ?`,
    [`deck_value:${deckId}`]
  );
  if (row.length === 0) return { value: null, computedAt: null };
  return { value: row[0].payload, computedAt: row[0].computed_at };
}
