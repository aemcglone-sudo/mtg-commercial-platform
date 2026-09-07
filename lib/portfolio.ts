import { findMany, run, withTimeout, toDateString } from '@/lib/db';
import { randomUUID } from 'crypto';

/** Cron-only, so a generous timeout is safe — matches lib/market-index.ts's
 * queryOne: lets a failure throw rather than silently returning partial
 * data, since a broken portfolio refresh should surface loudly, not quietly
 * cache a wrong total. */
async function query<T = any>(sql: string, args: (string | number)[], timeoutMs = 30000): Promise<T[]> {
  return withTimeout(timeoutMs, async (q) => (await q(sql, args)).rows as T[]);
}

export interface PortfolioHolding {
  scryfallId: string;
  cardName: string | null;
  setCode: string | null;
  usd: number | null;
  qty: number;
  positionValue: number | null;
  predictionDirection: string | null;
  confidencePct: number | null;
  targetPrice6m: number | null;
  matchedPattern: string | null;
}

export interface PortfolioPoint {
  date: string;
  value: number;
  cardsPriced: number;
}

export interface PortfolioSummary {
  totalValue: number;
  cardsOwned: number;
  cardsPriced: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  holdings: PortfolioHolding[];
  history: PortfolioPoint[];
}

/** Every distinct card the user owns (summed across duplicate entries —
 * multiple purchases, finishes, etc.), joined against the latest tracked
 * price and prediction. Measured live at ~12s for a ~3,800-item real
 * collection — same cost class as the market-wide boards, so this is
 * cron-cached exactly like Movers/High Value, never computed on page
 * load. Held back from "cards not price-tracked" honestly: not every
 * inventory item resolves to a scryfall_id, and not every scryfall_id has
 * a snapshot yet (both surfaced via cardsOwned vs cardsPriced). */
async function computeHoldings(userId: string): Promise<PortfolioHolding[]> {
  const rows = await query<any>(
    `WITH owned AS (
       SELECT "scryfallId" as scryfall_id, SUM(quantity) as qty
       FROM inventory_items
       WHERE "userId" = ? AND "scryfallId" IS NOT NULL
       GROUP BY "scryfallId"
     ),
     latest_price AS (
       SELECT DISTINCT ON (s.scryfall_id) s.scryfall_id, s.card_name, s.set_code, s.usd
       FROM market_price_snapshots s
       JOIN owned o ON o.scryfall_id = s.scryfall_id
       WHERE s.usd IS NOT NULL
       ORDER BY s.scryfall_id, s.price_date DESC
     ),
     latest_pred AS (
       SELECT DISTINCT ON (p.scryfall_id) p.scryfall_id, p.prediction_direction, p.confidence_pct, p.target_price_6m, p.matched_pattern
       FROM market_predictions p
       JOIN owned o ON o.scryfall_id = p.scryfall_id
       ORDER BY p.scryfall_id, p.date DESC
     )
     SELECT o.scryfall_id as "scryfallId", o.qty, lp.card_name as "cardName", lp.set_code as "setCode", lp.usd,
            pr.prediction_direction as "predictionDirection", pr.confidence_pct as "confidencePct",
            pr.target_price_6m as "targetPrice6m", pr.matched_pattern as "matchedPattern"
     FROM owned o
     LEFT JOIN latest_price lp ON lp.scryfall_id = o.scryfall_id
     LEFT JOIN latest_pred pr ON pr.scryfall_id = o.scryfall_id`,
    [userId],
    30000
  );
  return rows.map((r: any) => ({
    ...r,
    qty: Number(r.qty),
    usd: r.usd !== null ? Number(r.usd) : null,
    positionValue: r.usd !== null ? Number(r.usd) * Number(r.qty) : null,
    confidencePct: r.confidencePct !== null ? Number(r.confidencePct) : null,
    targetPrice6m: r.targetPrice6m !== null ? Number(r.targetPrice6m) : null,
  }));
}

/** Total collection value on every date we have price history for the
 * owned cards. Early dates will understate true value — before the
 * full-catalog sync started (~Sept 3), only a subset of any collection
 * had tracked prices, so cardsPriced climbs over the series; surfaced per
 * point so the UI can be honest about it rather than implying a full
 * history that isn't there. */
async function computeHistory(userId: string): Promise<PortfolioPoint[]> {
  const rows = await query<any>(
    `WITH owned AS (
       SELECT "scryfallId" as scryfall_id, SUM(quantity) as qty
       FROM inventory_items
       WHERE "userId" = ? AND "scryfallId" IS NOT NULL
       GROUP BY "scryfallId"
     )
     SELECT s.price_date as date, SUM(s.usd * o.qty) as value, COUNT(DISTINCT s.scryfall_id) as "cardsPriced"
     FROM market_price_snapshots s
     JOIN owned o ON o.scryfall_id = s.scryfall_id
     WHERE s.usd IS NOT NULL
     GROUP BY s.price_date
     ORDER BY s.price_date ASC`,
    [userId],
    30000
  );
  return rows.map((r: any) => ({ date: toDateString(r.date), value: Number(r.value), cardsPriced: Number(r.cardsPriced) }));
}

/** Every user with at least one price-linked inventory item — loops and
 * caches each one's portfolio, same pattern as the market-wide boards.
 * Cheap to loop: this app has a small number of collectors, not
 * thousands. */
export async function refreshPortfolioCache(): Promise<{ usersRefreshed: number; degraded: boolean }> {
  const users = await findMany<{ userId: string }>(
    `SELECT DISTINCT "userId" FROM inventory_items WHERE "scryfallId" IS NOT NULL`
  );

  let degraded = false;
  for (const { userId } of users) {
    const [holdings, history] = await Promise.all([computeHoldings(userId), computeHistory(userId)]);
    const cardsPriced = holdings.filter(h => h.usd !== null).length;
    const totalValue = holdings.reduce((a, h) => a + (h.positionValue ?? 0), 0);
    const bullishCount = holdings.filter(h => h.predictionDirection === 'bullish').length;
    const bearishCount = holdings.filter(h => h.predictionDirection === 'bearish').length;
    const neutralCount = holdings.filter(h => h.predictionDirection === 'neutral').length;

    const summary: PortfolioSummary = {
      totalValue, cardsOwned: holdings.length, cardsPriced, bullishCount, bearishCount, neutralCount, holdings, history,
    };

    await run(
      `INSERT INTO market_movers_cache (id, cache_key, payload, computed_at)
       VALUES (?, ?, ?, now())
       ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
      [randomUUID(), `portfolio:${userId}`, JSON.stringify(summary)]
    );
  }

  return { usersRefreshed: users.length, degraded };
}

export async function getCachedPortfolio(userId: string): Promise<{ summary: PortfolioSummary | null; computedAt: string | null }> {
  const row = await findMany<{ payload: PortfolioSummary; computed_at: string }>(
    `SELECT payload, computed_at FROM market_movers_cache WHERE cache_key = ?`,
    [`portfolio:${userId}`]
  );
  if (row.length === 0) return { summary: null, computedAt: null };
  return { summary: row[0].payload, computedAt: row[0].computed_at };
}
