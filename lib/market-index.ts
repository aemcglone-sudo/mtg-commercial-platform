import { findOne, findMany, run, withClient } from '@/lib/db';

function toDateString(d: string | Date): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Same reasoning as elsewhere: cron-only, so a generous timeout is safe —
 * but each of these queries is scoped to exactly ONE date (or one date
 * pair), never the whole history, specifically because a full-history
 * single-query version was tried three different ways and each one tipped
 * the DB into distress (see the session notes / commit message for the
 * gory details). A single date's ~9k rows are scattered across ~9-11k
 * disk pages on this table (it isn't clustered by date), so even one date
 * costs real seconds — but that's a bounded, survivable cost, unlike
 * touching most of the ~1M-row table in one pass. */
async function queryOne<T = any>(sql: string, args: (string | number)[], timeoutMs = 30000): Promise<T | null> {
  return withClient(async (q) => {
    await q(`SET statement_timeout = ${timeoutMs}`);
    const result = await q(sql, args);
    return (result.rows[0] as T) ?? null;
  });
}

async function getBaseDate(): Promise<string | null> {
  const row = await findOne<{ date: string | Date }>(`SELECT MIN(price_date) as date FROM market_price_snapshots`);
  return row?.date ? toDateString(row.date) : null;
}

async function getLatestSnapshotDate(): Promise<string | null> {
  const row = await findOne<{ date: string | Date }>(`SELECT MAX(price_date) as date FROM market_price_snapshots`);
  return row?.date ? toDateString(row.date) : null;
}

interface IndexForDate { indexValue: number | null; cardCount: number }

/** Equal-weighted index value for one date: every card's price is
 * expressed relative to its own baseline-date price, then averaged. Only
 * cards present (with a price) on both the baseline date and this date
 * count — new printings added after the baseline don't join the cohort,
 * so the constituent set (and the index) stays comparable day to day. */
async function computeIndexForDate(baseDate: string, date: string): Promise<IndexForDate> {
  const row = await queryOne<{ indexValue: string | null; cardCount: string }>(
    `WITH base AS (
       SELECT scryfall_id, usd as base_usd FROM market_price_snapshots
       WHERE price_date = ? AND usd IS NOT NULL AND usd > 0
     ),
     today AS (
       SELECT scryfall_id, usd FROM market_price_snapshots WHERE price_date = ? AND usd IS NOT NULL
     )
     SELECT AVG(today.usd / base.base_usd) * 100 as "indexValue", COUNT(*) as "cardCount"
     FROM today JOIN base ON base.scryfall_id = today.scryfall_id`,
    [baseDate, date]
  );
  return { indexValue: row?.indexValue !== null && row?.indexValue !== undefined ? Number(row.indexValue) : null, cardCount: Number(row?.cardCount ?? 0) };
}

interface BreadthForDate { advancers: number; decliners: number; unchanged: number; medianReturnPct: number | null }

/** Day-over-day breadth against the previous available snapshot date (not
 * necessarily "yesterday" on the calendar, in case of a gap) — restricted
 * to the same baseline cohort as the index, not the full tracked catalog.
 * Without that restriction, breadth would silently jump from ~8k cards to
 * ~85k the day the full-catalog sync started (Sept 3), making the paired
 * index/breadth chart compare different things before and after that date. */
async function computeBreadthForDate(baseDate: string, date: string): Promise<BreadthForDate> {
  const row = await queryOne<{ advancers: string; decliners: string; unchanged: string; medianReturnPct: string | null }>(
    `WITH base AS (
       SELECT scryfall_id FROM market_price_snapshots WHERE price_date = ? AND usd IS NOT NULL AND usd > 0
     ),
     prevdate AS (
       SELECT MAX(price_date) as d FROM market_price_snapshots WHERE price_date < ?
     ),
     today AS (SELECT scryfall_id, usd FROM market_price_snapshots WHERE price_date = ? AND usd IS NOT NULL),
     yesterday AS (SELECT scryfall_id, usd FROM market_price_snapshots WHERE price_date = (SELECT d FROM prevdate) AND usd IS NOT NULL)
     SELECT
       COUNT(*) FILTER (WHERE t.usd > y.usd) as advancers,
       COUNT(*) FILTER (WHERE t.usd < y.usd) as decliners,
       COUNT(*) FILTER (WHERE t.usd = y.usd) as unchanged,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (t.usd - y.usd) / NULLIF(y.usd, 0)) * 100 as "medianReturnPct"
     FROM today t JOIN yesterday y ON y.scryfall_id = t.scryfall_id
     JOIN base ON base.scryfall_id = t.scryfall_id`,
    [baseDate, date, date]
  );
  return {
    advancers: Number(row?.advancers ?? 0),
    decliners: Number(row?.decliners ?? 0),
    unchanged: Number(row?.unchanged ?? 0),
    medianReturnPct: row?.medianReturnPct !== null && row?.medianReturnPct !== undefined ? Number(row.medianReturnPct) : null,
  };
}

interface Concentration { top10Pct: number; top100Pct: number }

/** What share of the FULL current tracked catalog's total value sits in
 * the priciest cards — a snapshot-in-time health metric (not normalized
 * to the baseline cohort, unlike the index/breadth above, since the
 * question here is "how top-heavy is the market right now", not a trend).
 * Measured live at ~1s for ~85k rows — fine once/day, only for the latest
 * date (not backfilled historically, to keep the daily cost bounded). */
async function computeConcentration(date: string): Promise<Concentration | null> {
  const rows = await withClient(async (q) => {
    await q(`SET statement_timeout = 15000`);
    const result = await q(
      `SELECT usd FROM market_price_snapshots WHERE price_date = ? AND usd IS NOT NULL ORDER BY usd DESC`,
      [date]
    );
    return result.rows as { usd: number }[];
  });
  if (rows.length === 0) return null;
  const total = rows.reduce((a, r) => a + Number(r.usd), 0);
  if (total <= 0) return null;
  const top10 = rows.slice(0, 10).reduce((a, r) => a + Number(r.usd), 0);
  const top100 = rows.slice(0, 100).reduce((a, r) => a + Number(r.usd), 0);
  return { top10Pct: (top10 / total) * 100, top100Pct: (top100 / total) * 100 };
}

async function upsertIndexSnapshot(
  date: string, index: IndexForDate, breadth: BreadthForDate | null, concentration?: Concentration | null
): Promise<void> {
  if (concentration !== undefined) {
    await run(
      `INSERT INTO market_index_snapshots (date, index_value, card_count, advancers, decliners, unchanged, median_return_pct, concentration_top10_pct, concentration_top100_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (date) DO UPDATE SET
         index_value = EXCLUDED.index_value, card_count = EXCLUDED.card_count,
         advancers = EXCLUDED.advancers, decliners = EXCLUDED.decliners, unchanged = EXCLUDED.unchanged,
         median_return_pct = EXCLUDED.median_return_pct,
         concentration_top10_pct = EXCLUDED.concentration_top10_pct, concentration_top100_pct = EXCLUDED.concentration_top100_pct`,
      [date, index.indexValue, index.cardCount, breadth?.advancers ?? null, breadth?.decliners ?? null, breadth?.unchanged ?? null, breadth?.medianReturnPct ?? null,
       concentration?.top10Pct ?? null, concentration?.top100Pct ?? null]
    );
    return;
  }
  await run(
    `INSERT INTO market_index_snapshots (date, index_value, card_count, advancers, decliners, unchanged, median_return_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (date) DO UPDATE SET
       index_value = EXCLUDED.index_value, card_count = EXCLUDED.card_count,
       advancers = EXCLUDED.advancers, decliners = EXCLUDED.decliners, unchanged = EXCLUDED.unchanged,
       median_return_pct = EXCLUDED.median_return_pct`,
    [date, index.indexValue, index.cardCount, breadth?.advancers ?? null, breadth?.decliners ?? null, breadth?.unchanged ?? null, breadth?.medianReturnPct ?? null]
  );
}

export interface IndexRefreshResult {
  baseDate: string | null;
  latestDate: string | null;
  latestUpdated: boolean;
  backfilledDate: string | null;
  remainingGaps: number;
}

/** Called daily from the cron. Does at most 2 date computations — the
 * current latest date (always, so the index never falls behind) plus one
 * historical gap date (if any remain) — so the full backfill completes
 * gradually over ~90 cron runs instead of one heavy pass. Each date costs
 * real seconds on this DB (see the big comment up top), so deliberately
 * NOT doing more than that per run. */
export async function refreshMarketIndex(): Promise<IndexRefreshResult> {
  const baseDate = await getBaseDate();
  const latestDate = await getLatestSnapshotDate();
  if (!baseDate || !latestDate) {
    return { baseDate, latestDate, latestUpdated: false, backfilledDate: null, remainingGaps: 0 };
  }

  // Always refresh the latest date, so the index stays current even before backfill finishes.
  const latestIndex = await computeIndexForDate(baseDate, latestDate);
  const latestBreadth = latestDate === baseDate ? null : await computeBreadthForDate(baseDate, latestDate);
  const latestConcentration = await computeConcentration(latestDate);
  await upsertIndexSnapshot(latestDate, latestIndex, latestBreadth, latestConcentration);

  // Find every historical date with real snapshot data that doesn't have an index row yet.
  const missing = await findMany<{ priceDate: string }>(
    `SELECT DISTINCT s.price_date as "priceDate"
     FROM market_price_snapshots s
     LEFT JOIN market_index_snapshots i ON i.date = s.price_date
     WHERE i.date IS NULL AND s.price_date < ?
     ORDER BY s.price_date ASC`,
    [latestDate]
  );

  let backfilledDate: string | null = null;
  if (missing.length > 0) {
    const date = toDateString(missing[0].priceDate);
    const index = await computeIndexForDate(baseDate, date);
    const breadth = date === baseDate ? null : await computeBreadthForDate(baseDate, date);
    await upsertIndexSnapshot(date, index, breadth);
    backfilledDate = date;
  }

  return {
    baseDate,
    latestDate,
    latestUpdated: true,
    backfilledDate,
    remainingGaps: Math.max(0, missing.length - (backfilledDate ? 1 : 0)),
  };
}

export interface IndexPoint {
  date: string;
  indexValue: number;
  cardCount: number;
  advancers: number | null;
  decliners: number | null;
  unchanged: number | null;
  medianReturnPct: number | null;
  concentrationTop10Pct: number | null;
  concentrationTop100Pct: number | null;
}

export async function getIndexHistory(): Promise<IndexPoint[]> {
  const rows = await findMany<any>(
    `SELECT date, index_value as "indexValue", card_count as "cardCount",
            advancers, decliners, unchanged, median_return_pct as "medianReturnPct",
            concentration_top10_pct as "concentrationTop10Pct", concentration_top100_pct as "concentrationTop100Pct"
     FROM market_index_snapshots ORDER BY date ASC`
  );
  return rows.map(r => ({
    ...r, date: toDateString(r.date), indexValue: Number(r.indexValue),
    concentrationTop10Pct: r.concentrationTop10Pct !== null ? Number(r.concentrationTop10Pct) : null,
    concentrationTop100Pct: r.concentrationTop100Pct !== null ? Number(r.concentrationTop100Pct) : null,
  }));
}

export interface VolatilityInfo { daily7d: number | null; daily30d: number | null; trend: 'settling' | 'increasing' | 'stable' | null }

/** Index-level volatility (not per-card — see lib/signal-calculator.ts's
 * calculateVolatilitySignals() for why that's held back entirely). This is
 * cheap: stddev of the index's own day-over-day % change, over the small
 * (~90-row) market_index_snapshots table, not the raw price history. */
export async function getIndexVolatility(): Promise<VolatilityInfo> {
  const rows = await findMany<{ date: string; indexValue: string }>(
    `SELECT date, index_value as "indexValue" FROM market_index_snapshots ORDER BY date ASC`
  );
  if (rows.length < 3) return { daily7d: null, daily30d: null, trend: null };

  const returns: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = Number(rows[i - 1].indexValue);
    const cur = Number(rows[i].indexValue);
    if (prev > 0) returns.push((cur - prev) / prev);
  }
  const stddev = (arr: number[]) => {
    if (arr.length < 2) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance) * 100;
  };

  const daily7d = stddev(returns.slice(-7));
  const daily30d = stddev(returns.slice(-30));
  const trend = daily7d === null || daily30d === null ? null
    : daily7d < daily30d * 0.9 ? 'settling' : daily7d > daily30d * 1.1 ? 'increasing' : 'stable';

  return { daily7d, daily30d, trend };
}
