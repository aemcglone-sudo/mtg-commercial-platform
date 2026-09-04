import { run, withClient } from '@/lib/db';
import { getSets } from '@/lib/scryfall';

/** Same reasoning as lib/market.ts's queryWithTimeout — these queries only
 * ever run from the daily cron job, never a page request, so a generous
 * timeout is safe; it just means "fail this one signal today" rather than
 * "hang someone's page load." */
async function runWithTimeout(sql: string, args: (string | number)[] = [], timeoutMs = 90000): Promise<{ ok: boolean; error?: string }> {
  try {
    await withClient(async (q) => {
      await q(`SET statement_timeout = ${timeoutMs}`);
      await q(sql, args);
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** Refreshes market_set_release_dates from Scryfall's /sets endpoint —
 * cheap (~1000 rows), safe to run every day. */
export async function refreshSetReleaseDates(): Promise<number> {
  const sets = await getSets();
  let written = 0;
  const BATCH = 200;
  for (let i = 0; i < sets.length; i += BATCH) {
    const chunk = sets.slice(i, i + BATCH);
    const placeholders = chunk.map(() => '(?, ?, now())').join(', ');
    const params = chunk.flatMap((s) => [s.code, s.released_at ?? null]);
    await run(
      `INSERT INTO market_set_release_dates (set_code, released_at, updated_at)
       VALUES ${placeholders}
       ON CONFLICT (set_code) DO UPDATE SET released_at = EXCLUDED.released_at, updated_at = now()`,
      params
    );
    written += chunk.length;
  }
  return written;
}

export interface SignalStepResult { step: string; ok: boolean; error?: string; }

/**
 * Computes today's market_signals rows in a few separate set-based SQL
 * passes (never a per-card JS loop — see the movers-cache saga for why).
 * Each pass INSERTs the base row (if missing) then UPDATEs its own columns,
 * so a failure in one pass doesn't lose the others' results.
 */
export async function calculateSignals(): Promise<SignalStepResult[]> {
  const results: SignalStepResult[] = [];

  // ── Pass 1: seed today's rows + release phase + price anchors ──────────
  const seedSql = `
    INSERT INTO market_signals (id, scryfall_id, date, set_code, rarity, cmc, current_price, price_52w_high, price_52w_low, days_since_release, release_phase)
    SELECT
      md5(s.scryfall_id || s.price_date::text), -- deterministic id: unique per (scryfall_id, date), same as the table's own constraint
      s.scryfall_id, s.price_date, s.set_code, s.rarity, s.cmc, s.usd,
      hi.max_usd, lo.min_usd,
      (s.price_date - r.released_at),
      CASE
        WHEN r.released_at IS NULL THEN NULL
        WHEN (s.price_date - r.released_at) < 1 THEN 'presale'
        WHEN (s.price_date - r.released_at) < 7 THEN 'hype_spike'
        WHEN (s.price_date - r.released_at) < 21 THEN 'supply_flood'
        WHEN (s.price_date - r.released_at) < 90 THEN 'stabilization'
        ELSE 'mature'
      END
    FROM market_price_snapshots s
    LEFT JOIN market_set_release_dates r ON r.set_code = s.set_code
    LEFT JOIN LATERAL (
      SELECT MAX(usd) as max_usd FROM market_price_snapshots h
      WHERE h.scryfall_id = s.scryfall_id AND h.price_date >= s.price_date - 365 AND h.price_date <= s.price_date AND h.usd IS NOT NULL
    ) hi ON true
    LEFT JOIN LATERAL (
      SELECT MIN(usd) as min_usd FROM market_price_snapshots lo
      WHERE lo.scryfall_id = s.scryfall_id AND lo.price_date >= s.price_date - 365 AND lo.price_date <= s.price_date AND lo.usd IS NOT NULL
    ) lo ON true
    WHERE s.price_date = CURRENT_DATE AND s.usd IS NOT NULL
    ON CONFLICT (scryfall_id, date) DO UPDATE SET
      set_code = EXCLUDED.set_code, rarity = EXCLUDED.rarity, cmc = EXCLUDED.cmc,
      current_price = EXCLUDED.current_price, price_52w_high = EXCLUDED.price_52w_high, price_52w_low = EXCLUDED.price_52w_low,
      days_since_release = EXCLUDED.days_since_release, release_phase = EXCLUDED.release_phase
  `;
  results.push({ step: 'anchors_and_phase', ...(await runWithTimeout(seedSql, [])) });

  // ── Pass 2: momentum (7d / 30d / 90d) ───────────────────────────────────
  const momentumSql = `
    UPDATE market_signals sig SET
      momentum_7d = CASE WHEN p7.usd > 0 THEN (sig.current_price - p7.usd) / p7.usd ELSE NULL END,
      momentum_30d = CASE WHEN p30.usd > 0 THEN (sig.current_price - p30.usd) / p30.usd ELSE NULL END,
      momentum_90d = CASE WHEN p90.usd > 0 THEN (sig.current_price - p90.usd) / p90.usd ELSE NULL END
    FROM market_price_snapshots base
    LEFT JOIN market_price_snapshots p7 ON p7.scryfall_id = base.scryfall_id AND p7.price_date = base.price_date - 7
    LEFT JOIN market_price_snapshots p30 ON p30.scryfall_id = base.scryfall_id AND p30.price_date = base.price_date - 30
    LEFT JOIN market_price_snapshots p90 ON p90.scryfall_id = base.scryfall_id AND p90.price_date = base.price_date - 90
    WHERE base.price_date = CURRENT_DATE AND base.scryfall_id = sig.scryfall_id AND sig.date = CURRENT_DATE
  `;
  results.push({ step: 'momentum', ...(await runWithTimeout(momentumSql, [])) });

  // ── Pass 3: relative value — price vs this set's median today ──────────
  const medianSql = `
    WITH medians AS (
      SELECT set_code, percentile_cont(0.5) WITHIN GROUP (ORDER BY usd) as median_usd
      FROM market_price_snapshots
      WHERE price_date = CURRENT_DATE AND usd IS NOT NULL
      GROUP BY set_code
    )
    UPDATE market_signals sig SET
      price_vs_set_median = CASE WHEN m.median_usd > 0 THEN sig.current_price / m.median_usd ELSE NULL END
    FROM medians m
    WHERE m.set_code = sig.set_code AND sig.date = CURRENT_DATE
  `;
  results.push({ step: 'price_vs_set_median', ...(await runWithTimeout(medianSql, [])) });

  return results;
}

/**
 * Volatility — std dev of daily % change, 7d / 30d. NOT called by
 * calculateSignals() yet, and not wired into the daily cron.
 *
 * Live-tested at 500 rows (2.5s, extrapolates to ~8 min unrestricted) and
 * then at the ~8,300 cards with enough history to make volatility
 * statistically meaningful — that run strained the DB badly enough to trip
 * its health checks, well past what the row-count extrapolation predicted.
 * The LAG() window function over the full 30-day partition is the likely
 * cause; it needs actual optimization (a smaller window, a materialized
 * daily-returns table maintained incrementally, or similar) before it's
 * safe to run unattended, not just a bigger timeout budget.
 *
 * Left here deliberately unfinished/unwired rather than deleted — the
 * other three signal passes don't depend on it, and it's a fine problem to
 * revisit once there's more price history for the row-count math to make
 * more sense anyway (right now most cards have only 1-4 days on record).
 */
export async function calculateVolatilitySignals(scryfallIdLimit?: number): Promise<SignalStepResult> {
  const scopeLimit = scryfallIdLimit ? `LIMIT ${Math.floor(scryfallIdLimit)}` : '';
  const volatilitySql = `
    WITH scope AS (
      SELECT scryfall_id FROM market_price_snapshots
      WHERE price_date >= CURRENT_DATE - 30 AND usd IS NOT NULL
      GROUP BY scryfall_id HAVING count(*) >= 10
      ${scopeLimit}
    ),
    daily_returns AS (
      SELECT
        m.scryfall_id, m.price_date, m.usd,
        (m.usd - LAG(m.usd) OVER (PARTITION BY m.scryfall_id ORDER BY m.price_date)) / NULLIF(LAG(m.usd) OVER (PARTITION BY m.scryfall_id ORDER BY m.price_date), 0) as pct_change
      FROM market_price_snapshots m
      JOIN scope ON scope.scryfall_id = m.scryfall_id
      WHERE m.price_date >= CURRENT_DATE - 30 AND m.usd IS NOT NULL
    ),
    agg AS (
      SELECT
        scryfall_id,
        STDDEV(pct_change) FILTER (WHERE price_date >= CURRENT_DATE - 7) as vol_7d,
        STDDEV(pct_change) as vol_30d
      FROM daily_returns
      GROUP BY scryfall_id
    )
    UPDATE market_signals sig SET
      volatility_7d = agg.vol_7d,
      volatility_30d = agg.vol_30d
    FROM agg
    WHERE agg.scryfall_id = sig.scryfall_id AND sig.date = CURRENT_DATE
  `;
  return { step: 'volatility', ...(await runWithTimeout(volatilitySql, [], 120000)) };
}
