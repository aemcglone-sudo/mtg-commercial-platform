import { Pool } from 'pg';

const g = globalThis as { _pool?: Pool };
if (!g._pool) g._pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});
const pool = g._pool;

type Arg = string | number | boolean | null | string[];

function toPostgres(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql: string, args: Arg[] = [], retry = true): Promise<import('pg').QueryResult> {
  try {
    return await pool.query(toPostgres(sql), args);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (retry && (msg.includes('Connection terminated') || msg.includes('connect ECONNREFUSED') || msg.includes('terminating connection'))) {
      await new Promise(r => setTimeout(r, 250));
      return query(sql, args, false);
    }
    throw e;
  }
}

export async function findOne<T = Record<string, unknown>>(
  sql: string,
  args: Arg[] = []
): Promise<T | null> {
  const result = await query(sql, args);
  return result.rows[0] ?? null;
}

export async function findMany<T = Record<string, unknown>>(
  sql: string,
  args: Arg[] = []
): Promise<T[]> {
  const result = await query(sql, args);
  return result.rows;
}

export async function run(
  sql: string,
  args: Arg[] = []
): Promise<import('pg').QueryResult> {
  return query(sql, args);
}

// Use for long-running batch operations — checks out one connection,
// runs all queries on it, then releases it so the pool stays free.
export async function withClient<T>(fn: (q: (sql: string, args?: Arg[]) => Promise<import('pg').QueryResult>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    const q = (sql: string, args: Arg[] = []) => client.query(toPostgres(sql), args);
    return await fn(q);
  } finally {
    // Callers commonly do `SET statement_timeout = N` as the first thing
    // inside this client (see queryWithTimeout in lib/market.ts and
    // lib/market-index.ts) — that's a SESSION-level setting, and without
    // this reset it stays on the connection after release, poisoning it
    // for whatever unrelated query the pool hands it to next. That's a
    // real incident we hit live: vacuumSnapshots() (a plain run(), no
    // timeout override) got killed by a leftover 8000ms timeout set by
    // an earlier, unrelated request on the same pooled connection —
    // "canceling statement due to statement timeout" mid-VACUUM, which
    // needs far more than 8s. Reset happens even if fn() threw.
    try { await client.query('RESET statement_timeout'); } catch { /* connection may already be broken; nothing to reset */ }
    client.release();
  }
}

/** Runs fn() on a fresh client with a statement_timeout set for the
 * duration — shared low-level primitive behind lib/market.ts's
 * queryWithTimeout (which swallows a 57014 timeout into `timedOut: true`,
 * for boards that should degrade gracefully) and lib/market-index.ts's
 * queryOne (which lets a timeout throw, since a failed date should fail
 * loudly, not silently upsert an empty row). Was previously duplicated —
 * consolidated here so the two call sites can't drift out of sync on
 * exactly this kind of connection/timeout handling. */
export async function withTimeout<T>(timeoutMs: number, fn: (q: (sql: string, args?: Arg[]) => Promise<import('pg').QueryResult>) => Promise<T>): Promise<T> {
  return withClient(async (q) => {
    await q(`SET statement_timeout = ${timeoutMs}`);
    return fn(q);
  });
}

/** Postgres DATE columns come back from `pg` as JS Date objects (not
 * strings) — naive `String(date).slice(0,10)` produces "Fri Jun 05"
 * instead of "2026-06-05". Was duplicated verbatim in two files. */
export function toDateString(d: string | Date): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}
