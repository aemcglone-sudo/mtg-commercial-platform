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
    client.release();
  }
}
