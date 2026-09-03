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

export async function addCardToWatchlist(userId: string, scryfallId: string, cardName: string): Promise<void> {
  await run(
    `INSERT INTO market_watchlist_items (id, user_id, kind, scryfall_id, card_name, created_at)
     VALUES (?, ?, 'card', ?, ?, now())
     ON CONFLICT (user_id, kind, scryfall_id, set_code) DO NOTHING`,
    [randomUUID(), userId, scryfallId, cardName]
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

/** Sets ranked by % change in average card price over the window — a "gainers/losers" board. */
export async function getSetMovers(days: number, limit = 20): Promise<{ movers: SetMover[]; degraded: boolean }> {
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
    [days]
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

export async function getCardMovers(days: number, limit = 20, direction: 'gainers' | 'losers' = 'gainers'): Promise<{ movers: CardMover[]; degraded: boolean }> {
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
    [days, limit]
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
