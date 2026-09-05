import { findMany, run, withClient } from '@/lib/db';
import { randomUUID } from 'crypto';

/** Runs a query with a short statement_timeout so a degraded/overloaded DB
 * fails fast instead of hanging the request indefinitely — reports
 * `timedOut: true` (instead of throwing) specifically on a timeout, since a
 * slow "movers" board is much better shown as empty/stale than as a stuck
 * spinner. Real errors (bad SQL, connection failure) still throw. */
async function queryWithTimeout<T = any>(sql: string, args: (string | number)[], timeoutMs = 8000): Promise<{ rows: T[]; timedOut: boolean }> {
  try {
    const rows = await withClient(async (q) => {
      await q(`SET statement_timeout = ${timeoutMs}`);
      const result = await q(sql, args);
      return result.rows as T[];
    });
    return { rows, timedOut: false };
  } catch (e: any) {
    if (e?.code === '57014') return { rows: [], timedOut: true }; // query_canceled (statement_timeout)
    throw e;
  }
}

export interface WatchlistItem {
  id: string;
  kind: 'card' | 'set';
  scryfallId: string | null;
  cardName: string | null;
  setCode: string | null;
  setName: string | null;
  createdAt: string;
}

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  const rows = await findMany<any>(
    `SELECT id, kind, scryfall_id as "scryfallId", card_name as "cardName",
            set_code as "setCode", set_name as "setName", created_at as "createdAt"
     FROM market_watchlist_items WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

/** setCode/setName identify the printing being watched — a card name alone is
 * ambiguous once the same card has multiple printings with different prices. */
export async function addCardToWatchlist(userId: string, scryfallId: string, cardName: string, setCode?: string | null, setName?: string | null): Promise<void> {
  await run(
    `INSERT INTO market_watchlist_items (id, user_id, kind, scryfall_id, card_name, set_code, set_name, created_at)
     VALUES (?, ?, 'card', ?, ?, ?, ?, now())
     ON CONFLICT (user_id, kind, scryfall_id, set_code) DO NOTHING`,
    [randomUUID(), userId, scryfallId, cardName, setCode ?? null, setName ?? null]
  );
}

export async function addSetToWatchlist(userId: string, setCode: string, setName: string): Promise<void> {
  await run(
    `INSERT INTO market_watchlist_items (id, user_id, kind, set_code, set_name, created_at)
     VALUES (?, ?, 'set', ?, ?, now())
     ON CONFLICT (user_id, kind, scryfall_id, set_code) DO NOTHING`,
    [randomUUID(), userId, setCode, setName]
  );
}

export async function removeFromWatchlist(userId: string, id: string): Promise<void> {
  await run(`DELETE FROM market_watchlist_items WHERE id = ? AND user_id = ?`, [id, userId]);
}

export interface PricePoint { date: string; usd: number | null; usdFoil: number | null; }

export async function getCardHistory(scryfallId: string, days: number): Promise<PricePoint[]> {
  const { rows } = await queryWithTimeout(
    `SELECT price_date as "date", usd, usd_foil as "usdFoil"
     FROM market_price_snapshots
     WHERE scryfall_id = ? AND price_date >= (CURRENT_DATE - ?::int)
     ORDER BY price_date ASC`,
    [scryfallId, days]
  );
  return rows.map((r: any) => ({ ...r, date: toDateString(r.date) }));
}

export interface SetIndexPoint { date: string; avgUsd: number | null; cardCount: number; }

export async function getSetHistory(setCode: string, days: number): Promise<SetIndexPoint[]> {
  const { rows } = await queryWithTimeout(
    `SELECT price_date as "date", AVG(usd) as "avgUsd", COUNT(usd) as "cardCount"
     FROM market_price_snapshots
     WHERE set_code = ? AND price_date >= (CURRENT_DATE - ?::int) AND usd IS NOT NULL
     GROUP BY price_date
     ORDER BY price_date ASC`,
    [setCode, days]
  );
  return rows.map((r: any) => ({ date: toDateString(r.date), avgUsd: r.avgUsd !== null ? Number(r.avgUsd) : null, cardCount: Number(r.cardCount) }));
}

export interface SetMover { setCode: string; avgUsdNow: number; avgUsdBefore: number; changePercent: number; cardCount: number; }

/** Sets ranked by % change in average card price over the window — a "gainers/losers" board.
 * Expensive (whole-table self-join) — only called by refreshMoversCache(), never on a page
 * request. See getCachedSetMovers() for what the API route actually reads. */
async function computeSetMovers(days: number, limit = 20): Promise<{ movers: SetMover[]; degraded: boolean }> {
  const { rows, timedOut } = await queryWithTimeout(
    `WITH bounds AS (
       SELECT set_code, MIN(price_date) as first_date, MAX(price_date) as last_date
       FROM market_price_snapshots
       WHERE price_date >= (CURRENT_DATE - ?::int)
       GROUP BY set_code
       HAVING MIN(price_date) < MAX(price_date)
     ),
     firstvals AS (
       SELECT s.set_code, AVG(s.usd) as avg_usd, COUNT(s.usd) as card_count
       FROM market_price_snapshots s
       JOIN bounds b ON b.set_code = s.set_code AND s.price_date = b.first_date
       WHERE s.usd IS NOT NULL
       GROUP BY s.set_code
     ),
     lastvals AS (
       SELECT s.set_code, AVG(s.usd) as avg_usd
       FROM market_price_snapshots s
       JOIN bounds b ON b.set_code = s.set_code AND s.price_date = b.last_date
       WHERE s.usd IS NOT NULL
       GROUP BY s.set_code
     )
     SELECT f.set_code as "setCode", l.avg_usd as "avgUsdNow", f.avg_usd as "avgUsdBefore",
            f.card_count as "cardCount"
     FROM firstvals f JOIN lastvals l ON l.set_code = f.set_code
     WHERE f.avg_usd > 0
     ORDER BY (l.avg_usd - f.avg_usd) / f.avg_usd DESC`,
    [days],
    60000 // this only ever runs from the cron job, never a page request — fine to let it work
  );
  const movers = rows
    .map((r: any) => ({
      setCode: r.setCode,
      avgUsdNow: Number(r.avgUsdNow),
      avgUsdBefore: Number(r.avgUsdBefore),
      cardCount: Number(r.cardCount),
      changePercent: ((Number(r.avgUsdNow) - Number(r.avgUsdBefore)) / Number(r.avgUsdBefore)) * 100,
    }))
    .slice(0, limit);
  return { movers, degraded: timedOut };
}

export interface CardMover { scryfallId: string; cardName: string; setCode: string; usdNow: number; usdBefore: number; changePercent: number; }

/** Expensive — only called by refreshMoversCache(). See getCachedCardMovers(). */
async function computeCardMovers(days: number, limit = 20, direction: 'gainers' | 'losers' = 'gainers'): Promise<{ movers: CardMover[]; degraded: boolean }> {
  const { rows, timedOut } = await queryWithTimeout(
    `WITH bounds AS (
       SELECT scryfall_id, MIN(price_date) as first_date, MAX(price_date) as last_date
       FROM market_price_snapshots
       WHERE price_date >= (CURRENT_DATE - ?::int)
       GROUP BY scryfall_id
       HAVING MIN(price_date) < MAX(price_date)
     ),
     firstvals AS (
       SELECT s.scryfall_id, s.card_name, s.set_code, s.usd
       FROM market_price_snapshots s
       JOIN bounds b ON b.scryfall_id = s.scryfall_id AND s.price_date = b.first_date
       WHERE s.usd IS NOT NULL AND s.usd >= 0.25
     ),
     lastvals AS (
       SELECT s.scryfall_id, s.usd
       FROM market_price_snapshots s
       JOIN bounds b ON b.scryfall_id = s.scryfall_id AND s.price_date = b.last_date
       WHERE s.usd IS NOT NULL
     )
     SELECT f.scryfall_id as "scryfallId", f.card_name as "cardName", f.set_code as "setCode",
            l.usd as "usdNow", f.usd as "usdBefore"
     FROM firstvals f JOIN lastvals l ON l.scryfall_id = f.scryfall_id
     ORDER BY (l.usd - f.usd) / f.usd ${direction === 'gainers' ? 'DESC' : 'ASC'}
     LIMIT ?`,
    [days, limit],
    60000 // cron-only, same reasoning as computeSetMovers above
  );
  const movers = rows.map((r: any) => ({
    ...r,
    usdNow: Number(r.usdNow),
    usdBefore: Number(r.usdBefore),
    changePercent: ((Number(r.usdNow) - Number(r.usdBefore)) / Number(r.usdBefore)) * 100,
  }));
  return { movers, degraded: timedOut };
}

function toDateString(d: string | Date): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// ── Movers cache ─────────────────────────────────────────────────────────
// The movers queries above are whole-table self-joins — fine to run once a
// day from the cron job, much too heavy to run on every page load. The API
// route reads only from this cache; refreshMoversCache() (called at the end
// of the daily sync) is the only thing that ever runs the live queries.

const WINDOWS = [7, 30, 90];

export async function getCachedSetMovers(days: number): Promise<{ gainers: SetMover[]; losers: SetMover[]; computedAt: string | null }> {
  return getCachedMovers<SetMover>(`set:${days}`);
}

export async function getCachedCardMovers(days: number): Promise<{ gainers: CardMover[]; losers: CardMover[]; computedAt: string | null }> {
  return getCachedMovers<CardMover>(`card:${days}`);
}

async function getCachedMovers<T>(cacheKey: string): Promise<{ gainers: T[]; losers: T[]; computedAt: string | null }> {
  const row = await findMany<{ payload: { gainers: T[]; losers: T[] }; computed_at: string }>(
    `SELECT payload, computed_at FROM market_movers_cache WHERE cache_key = ?`,
    [cacheKey]
  );
  if (row.length === 0) return { gainers: [], losers: [], computedAt: null };
  return { gainers: row[0].payload.gainers ?? [], losers: row[0].payload.losers ?? [], computedAt: row[0].computed_at };
}

async function upsertMoversCache(cacheKey: string, payload: unknown): Promise<void> {
  await run(
    `INSERT INTO market_movers_cache (id, cache_key, payload, computed_at)
     VALUES (?, ?, ?, now())
     ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [randomUUID(), cacheKey, JSON.stringify(payload)]
  );
}

/** VACUUM ANALYZE on the snapshots table. The daily sync's ~97k upserts
 * leave that many dead tuples behind (ON CONFLICT DO UPDATE), which bloats
 * the table enough to make the movers aggregation slow (80s+ instead of
 * <100ms) until autovacuum gets to it on its own schedule. Running this
 * explicitly, right after the sync and before the movers refresh, keeps
 * the cache refresh fast every day instead of only on days autovacuum
 * happens to have already caught up. */
export async function vacuumSnapshots(): Promise<void> {
  await run('VACUUM ANALYZE market_price_snapshots');
}

export interface MoversRefreshResult { cacheKey: string; degraded: boolean }

/** Recomputes every (type, window) combination and stores the result. Called
 * once at the end of the daily price sync — never from a page request. */
export async function refreshMoversCache(): Promise<MoversRefreshResult[]> {
  const results: MoversRefreshResult[] = [];

  for (const days of WINDOWS) {
    const { movers: sets, degraded } = await computeSetMovers(days, 200);
    const gainers = sets.filter(s => s.changePercent > 0).slice(0, 20);
    const losers = [...sets].reverse().filter(s => s.changePercent < 0).slice(0, 20);
    await upsertMoversCache(`set:${days}`, { gainers, losers });
    results.push({ cacheKey: `set:${days}`, degraded });
  }

  for (const days of WINDOWS) {
    const [gainersRes, losersRes] = await Promise.all([
      computeCardMovers(days, 20, 'gainers'),
      computeCardMovers(days, 20, 'losers'),
    ]);
    await upsertMoversCache(`card:${days}`, { gainers: gainersRes.movers, losers: losersRes.movers });
    results.push({ cacheKey: `card:${days}`, degraded: gainersRes.degraded || losersRes.degraded });
  }

  return results;
}

// ── Signals (read side — computed by lib/signal-calculator.ts) ────────────

export interface CardSignal {
  date: string;
  setCode: string;
  rarity: string | null;
  cmc: number | null;
  daysSinceRelease: number | null;
  releasePhase: string | null;
  momentum7d: number | null;
  momentum30d: number | null;
  momentum90d: number | null;
  volatility7d: number | null;
  volatility30d: number | null;
  priceVsSetMedian: number | null;
  currentPrice: number | null;
  price52wHigh: number | null;
  price52wLow: number | null;
}

export async function getLatestSignal(scryfallId: string): Promise<CardSignal | null> {
  const { rows } = await queryWithTimeout<any>(
    `SELECT date, set_code as "setCode", rarity, cmc,
            days_since_release as "daysSinceRelease", release_phase as "releasePhase",
            momentum_7d as "momentum7d", momentum_30d as "momentum30d", momentum_90d as "momentum90d",
            volatility_7d as "volatility7d", volatility_30d as "volatility30d",
            price_vs_set_median as "priceVsSetMedian",
            current_price as "currentPrice", price_52w_high as "price52wHigh", price_52w_low as "price52wLow"
     FROM market_signals
     WHERE scryfall_id = ?
     ORDER BY date DESC
     LIMIT 1`,
    [scryfallId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { ...r, date: toDateString(r.date) };
}

// ── Predictions (read side — computed by lib/prediction-engine.ts) ────────

export interface DominantSignal { signal: string; value: string | number | null; }

export interface CardPrediction {
  date: string;
  currentPrice: number | null;
  targetPrice6m: number | null;
  targetPrice6mLow: number | null;
  targetPrice6mHigh: number | null;
  confidencePct: number | null;
  predictionDirection: string | null;
  matchedPattern: string | null;
  dominantSignals: DominantSignal[];
  upsideScenario: string | null;
  upsideTarget: number | null;
  downsideScenario: string | null;
  downsideTarget: number | null;
  riskFactors: string[];
}

export async function getLatestPrediction(scryfallId: string): Promise<CardPrediction | null> {
  const { rows } = await queryWithTimeout<any>(
    `SELECT date, current_price as "currentPrice",
            target_price_6m as "targetPrice6m", target_price_6m_low as "targetPrice6mLow", target_price_6m_high as "targetPrice6mHigh",
            confidence_pct as "confidencePct", prediction_direction as "predictionDirection", matched_pattern as "matchedPattern",
            dominant_signals as "dominantSignals",
            upside_scenario as "upsideScenario", upside_target as "upsideTarget",
            downside_scenario as "downsideScenario", downside_target as "downsideTarget",
            risk_factors as "riskFactors"
     FROM market_predictions
     WHERE scryfall_id = ?
     ORDER BY date DESC
     LIMIT 1`,
    [scryfallId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { ...r, date: toDateString(r.date), dominantSignals: r.dominantSignals ?? [], riskFactors: r.riskFactors ?? [] };
}

export interface CardPrinting {
  scryfallId: string;
  setCode: string;
  usd: number | null;
  usdFoil: number | null;
  priceDate: string;
}

/** All printings of a card we actually track price history for — a card
 * like Sol Ring or Arcane Signet has dozens of reprints spanning wildly
 * different prices, and this powers the "switch printing" selector on the
 * card detail page so a collector can see the specific printing's own
 * price line, not whichever one a name search happened to land on.
 * Looked up by card_name against our own snapshots (cheap, indexed),
 * rather than a live Scryfall call. */
export async function getPrintings(scryfallId: string): Promise<CardPrinting[]> {
  const nameRow = await queryWithTimeout<{ cardName: string }>(
    `SELECT card_name as "cardName" FROM market_price_snapshots WHERE scryfall_id = ? LIMIT 1`,
    [scryfallId]
  );
  const cardName = nameRow.rows[0]?.cardName;
  if (!cardName) return [];

  const { rows } = await queryWithTimeout<any>(
    `SELECT DISTINCT ON (scryfall_id)
       scryfall_id as "scryfallId", set_code as "setCode", usd, usd_foil as "usdFoil", price_date as "priceDate"
     FROM market_price_snapshots
     WHERE card_name = ?
     ORDER BY scryfall_id, price_date DESC`,
    [cardName]
  );
  return rows.map((r: any) => ({ ...r, priceDate: toDateString(r.priceDate) }))
    .sort((a: CardPrinting, b: CardPrinting) => (b.usd ?? 0) - (a.usd ?? 0));
}
