import { Pool } from 'pg';

const g = globalThis as { _pool?: Pool };
if (!g._pool) g._pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pool = g._pool;

type Arg = string | number | boolean | null | string[];

function toPostgres(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function findOne<T = Record<string, unknown>>(
  sql: string,
  args: Arg[] = []
): Promise<T | null> {
  const result = await pool.query(toPostgres(sql), args);
  return result.rows[0] ?? null;
}

export async function findMany<T = Record<string, unknown>>(
  sql: string,
  args: Arg[] = []
): Promise<T[]> {
  const result = await pool.query(toPostgres(sql), args);
  return result.rows;
}

export async function run(
  sql: string,
  args: Arg[] = []
): Promise<void> {
  await pool.query(toPostgres(sql), args);
}
