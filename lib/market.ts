import { findMany, run, withClient } from '@/lib/db';
import { randomUUID } from 'crypto';
import { getSets } from '@/lib/scryfall';

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

export interface SetMover { setCode: string; avgUsdNow: number; avgUsdBefore: number; changePercent: number; cardCount: number; sparkline?: number[]; }

/** Daily avg-price series for a handful of sets over a window — one query
 * for all of them (not one per set), used to attach a sparkline to each
 * Set Movers row. Only ever called for the ~40 sets already selected as
 * gainers/losers, from the cron, right before caching — never live. */
async function getSparklineSeriesForSets(setCodes: string[], days: number): Promise<Map<string, number[]>> {
  if (setCodes.length === 0) return new Map();
  const { rows } = await queryWithTimeout<{ setCode: string; date: string; avgUsd: number | null }>(
    `SELECT set_code as "setCode", price_date as "date", AVG(usd) as "avgUsd"
     FROM market_price_snapshots
     WHERE set_code = ANY(?) AND price_date >= (CURRENT_DATE - ?::int) AND usd IS NOT NULL
     GROUP BY set_code, price_date
     ORDER BY set_code, price_date ASC`,
    [setCodes as any, days],
    30000
  );
  const map = new Map<string, number[]>();
  for (const r of rows) {
    const arr = map.get(r.setCode) ?? [];
    if (r.avgUsd !== null) arr.push(Number(r.avgUsd));
    map.set(r.setCode, arr);
  }
  return map;
}

/** Sets ranked by % change in average card price over the window — a
 * "gainers/losers" board. Expensive (whole-table self-join) — only called
 * by refreshMoversCache(), never on a page request. See
 * getCachedSetMovers() for what the API route actually reads.
 *
 * Requires at least MIN_SET_CARD_COUNT tracked cards on both ends of the
 * window — without a floor, over half of all tracked "sets" (mostly
 * single-card promo drops) move on the strength of 1-3 cards' price
 * swings, producing noise like a lone promo card showing as a +5000% "set"
 * move. 10 was picked from the actual distribution: below it is
 * overwhelmingly 1-3-card promo pools, at/above it starts looking like
 * real (if small) supplemental sets.
 *
 * Deliberately unlimited otherwise (not sliced to top-N here), because
 * slicing before splitting into gainers/losers silently drops all losers
 * whenever there are more gainers than the limit (which is most of the
 * time) — that's exactly what was happening when this took a `limit`
 * param. The caller slices each side after splitting instead. */
const MIN_SET_CARD_COUNT = 10;

async function computeSetMovers(days: number): Promise<{ movers: SetMover[]; degraded: boolean }> {
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
     WHERE f.avg_usd > 0 AND f.card_count >= ?
     ORDER BY (l.avg_usd - f.avg_usd) / f.avg_usd DESC`,
    [days, MIN_SET_CARD_COUNT],
    60000 // this only ever runs from the cron job, never a page request — fine to let it work
  );
  const movers = rows
    .map((r: any) => ({
      setCode: r.setCode,
      avgUsdNow: Number(r.avgUsdNow),
      avgUsdBefore: Number(r.avgUsdBefore),
      cardCount: Number(r.cardCount),
      changePercent: ((Number(r.avgUsdNow) - Number(r.avgUsdBefore)) / Number(r.avgUsdBefore)) * 100,
    }));
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

/** market_predictions gets a full-table ON CONFLICT DO UPDATE every day
 * (calculatePredictions()) — same dead-tuple bloat pattern that caused the
 * original DB incident on market_price_snapshots. Confirmed live: after
 * two same-day upserts, the Scoreboard's date+direction+confidence index
 * scan went from ~40ms to 5.3s until this ran. */
export async function vacuumPredictions(): Promise<void> {
  await run('VACUUM ANALYZE market_predictions');
}

export interface MoversRefreshResult { cacheKey: string; degraded: boolean }

/** Recomputes every (type, window) combination and stores the result. Called
 * once at the end of the daily price sync — never from a page request. */
export async function refreshMoversCache(): Promise<MoversRefreshResult[]> {
  const results: MoversRefreshResult[] = [];

  // market_price_snapshots only has set_code, not set_type — token sets
  // (and similar non-card "sets") aren't distinguishable in SQL, so filter
  // them out here using Scryfall's own classification.
  const allSets = await getSets();
  const tokenSetCodes = new Set(allSets.filter(s => s.set_type === 'token').map(s => s.code));

  for (const days of WINDOWS) {
    const { movers: allMovers, degraded } = await computeSetMovers(days);
    const sets = allMovers.filter(s => !tokenSetCodes.has(s.setCode));
    const gainers = sets.filter(s => s.changePercent > 0).slice(0, 10);
    const losers = [...sets].reverse().filter(s => s.changePercent < 0).slice(0, 10);

    const shownCodes = [...gainers, ...losers].map(s => s.setCode);
    const sparklines = await getSparklineSeriesForSets(shownCodes, days);
    for (const s of [...gainers, ...losers]) s.sparkline = sparklines.get(s.setCode) ?? [];

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

export interface ScoreboardRow {
  scryfallId: string;
  cardName: string;
  setCode: string;
  predictionDirection: string;
  confidencePct: number;
  currentPrice: number;
  targetPrice6m: number;
  matchedPattern: string;
}
export type ScoreboardDirection = 'bullish' | 'bearish' | 'neutral';
export type ScoreboardSort = 'confidence' | 'price';

/** All predictions for the latest date, filtered/sorted. Every column read
 * here is denormalized directly onto market_predictions (see
 * calculatePredictions()) specifically so this never has to join against
 * market_signals or market_price_snapshots on a live page load — that join
 * measured at ~6s across 85k+ rows, well over budget. */
export async function getScoreboard(
  direction: ScoreboardDirection,
  sortBy: ScoreboardSort,
  limit = 50
): Promise<{ rows: ScoreboardRow[]; timedOut: boolean }> {
  const orderBy = sortBy === 'price'
    ? 'current_price DESC'
    : 'confidence_pct DESC, current_price DESC';
  const { rows, timedOut } = await queryWithTimeout<any>(
    `SELECT scryfall_id as "scryfallId", card_name as "cardName", set_code as "setCode",
            prediction_direction as "predictionDirection", confidence_pct as "confidencePct",
            current_price as "currentPrice", target_price_6m as "targetPrice6m", matched_pattern as "matchedPattern"
     FROM market_predictions
     WHERE date = (SELECT max(date) FROM market_predictions)
       AND prediction_direction = ?
       AND card_name IS NOT NULL
     ORDER BY ${orderBy}
     LIMIT ?`,
    [direction, Math.min(limit, 100)]
  );
  return { rows, timedOut };
}

export interface SetPredictionRow {
  scryfallId: string; cardName: string; currentPrice: number; targetPrice6m: number | null;
  confidencePct: number; predictionDirection: string; matchedPattern: string;
}
export interface SetPrediction {
  totalCards: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  avgTargetPct: number | null;
  avgConfidencePct: number | null;
  direction: 'bullish' | 'bearish' | 'neutral';
  chaseConcentrationPct: number | null;
  bullCase: string;
  bearCase: string;
  topBullish: SetPredictionRow[];
  topBearish: SetPredictionRow[];
  topValue: SetPredictionRow[];
}

/** Aggregates the existing per-card prediction engine up to the set level
 * — "should I buy from this set?" instead of one card at a time. Fetches
 * every card's latest prediction for the set in one query (a set is only
 * ever ~150-500 cards, so aggregating in JS is simpler and just as fast as
 * doing it in SQL) and computes everything else here. Live per page load,
 * same as getSetTopCards — a single (date, set_code) lookup is cheap
 * (~40ms measured), unlike the whole-table aggregates that need caching. */
export async function getSetPrediction(setCode: string): Promise<SetPrediction | null> {
  const { rows } = await queryWithTimeout<any>(
    `SELECT scryfall_id as "scryfallId", card_name as "cardName", current_price as "currentPrice",
            target_price_6m as "targetPrice6m", confidence_pct as "confidencePct",
            prediction_direction as "predictionDirection", matched_pattern as "matchedPattern"
     FROM market_predictions
     WHERE date = (SELECT MAX(date) FROM market_predictions) AND set_code = ?
       AND current_price IS NOT NULL AND current_price > 0`,
    [setCode]
  );
  if (rows.length === 0) return null;

  const cards: SetPredictionRow[] = rows.map((r: any) => ({
    ...r, currentPrice: Number(r.currentPrice), confidencePct: Number(r.confidencePct),
    targetPrice6m: r.targetPrice6m !== null ? Number(r.targetPrice6m) : null,
  }));

  const bullish = cards.filter(c => c.predictionDirection === 'bullish');
  const bearish = cards.filter(c => c.predictionDirection === 'bearish');
  const neutral = cards.filter(c => c.predictionDirection === 'neutral');

  const targetPcts = cards
    .filter(c => c.targetPrice6m !== null)
    .map(c => (c.targetPrice6m! - c.currentPrice) / c.currentPrice);
  const avgTargetPct = targetPcts.length > 0 ? targetPcts.reduce((a, b) => a + b, 0) / targetPcts.length : null;
  const avgConfidencePct = cards.reduce((a, c) => a + c.confidencePct, 0) / cards.length;
  const direction = avgTargetPct === null ? 'neutral' : avgTargetPct > 0.05 ? 'bullish' : avgTargetPct < -0.05 ? 'bearish' : 'neutral';

  const byValueDesc = [...cards].sort((a, b) => b.currentPrice - a.currentPrice);
  const totalValue = cards.reduce((a, c) => a + c.currentPrice, 0);
  const top5Value = byValueDesc.slice(0, 5).reduce((a, c) => a + c.currentPrice, 0);
  const chaseConcentrationPct = totalValue > 0 ? (top5Value / totalValue) * 100 : null;

  const bullCaseReasons: string[] = [];
  if (chaseConcentrationPct !== null && chaseConcentrationPct < 50) bullCaseReasons.push('value is spread across many cards, not dependent on a few chase pieces');
  if (cards.length > 0 && bullish.length / cards.length > 0.4) bullCaseReasons.push('a large share of tracked cards are trending bullish');
  const bullCase = bullCaseReasons.length > 0
    ? `This set offers: ${bullCaseReasons.join('; ')}.`
    : 'No strong bullish signal across this set right now.';

  const bearCaseReasons: string[] = [];
  if (chaseConcentrationPct !== null && chaseConcentrationPct > 70) bearCaseReasons.push('heavily concentrated in a handful of chase cards — a single reprint or price move could sway the whole set');
  if (cards.length > 0 && bearish.length / cards.length > 0.3) bearCaseReasons.push('a meaningful share of tracked cards are trending bearish');
  const bearCase = bearCaseReasons.length > 0
    ? `Watch out for: ${bearCaseReasons.join('; ')}.`
    : 'No strong bearish signal across this set right now.';

  return {
    totalCards: cards.length,
    bullishCount: bullish.length,
    bearishCount: bearish.length,
    neutralCount: neutral.length,
    avgTargetPct, avgConfidencePct, direction, chaseConcentrationPct, bullCase, bearCase,
    topBullish: [...bullish].sort((a, b) => b.confidencePct - a.confidencePct).slice(0, 5),
    topBearish: [...bearish].sort((a, b) => b.confidencePct - a.confidencePct).slice(0, 5),
    topValue: byValueDesc.slice(0, 5),
  };
}

export interface SetTopCard { scryfallId: string; cardName: string; usd: number }

/** Highest-priced cards in a set, as of the most recent snapshot date for
 * that set specifically (not necessarily today, if a set's cards happen
 * to be missing from the very latest sync) — powers the set detail
 * panel's "high value cards" list. */
export async function getSetTopCards(setCode: string, limit = 10): Promise<SetTopCard[]> {
  const { rows } = await queryWithTimeout<SetTopCard>(
    `SELECT scryfall_id as "scryfallId", card_name as "cardName", usd
     FROM market_price_snapshots
     WHERE set_code = ? AND price_date = (SELECT MAX(price_date) FROM market_price_snapshots WHERE set_code = ?) AND usd IS NOT NULL
     ORDER BY usd DESC
     LIMIT ?`,
    [setCode, setCode, limit]
  );
  return rows.map(r => ({ ...r, usd: Number(r.usd) }));
}
