import { Pool } from 'pg';

const g = globalThis as { _pool?: Pool };
if (!g._pool) g._pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pool = g._pool;

function toPostgres(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function findOne<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = []
): Promise<T | null> {
  const result = await pool.query(toPostgres(sql), args);
  return result.rows[0] ?? null;
}

export async function findMany<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = []
): Promise<T[]> {
  const result = await pool.query(toPostgres(sql), args);
  return result.rows;
}

export async function run(
  sql: string,
  args: (string | number | null)[] = []
): Promise<void> {
  await pool.query(toPostgres(sql), args);
}
