/**
 * Database client — uses @libsql/client directly against the SQLite file.
 * Prisma handles schema & migrations; we query at runtime with libsql.
 */

// Use the Node.js-specific client — the default client uses Web APIs
// which don't support file: URLs when bundled by Next.js.
import { createClient, type Client } from '@libsql/client/node';

const DB_URL = process.env.DATABASE_URL ?? 'file:./dev.db';

// Singleton — reused across hot reloads in Next.js dev mode
const g = globalThis as { _db?: Client };
if (!g._db) g._db = createClient({ url: DB_URL });
export const db = g._db;

// ── Typed helpers ──────────────────────────────────────────────────────────

export async function findOne<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = []
): Promise<T | null> {
  const result = await db.execute({ sql, args });
  return (result.rows[0] as T) ?? null;
}

export async function findMany<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = []
): Promise<T[]> {
  const result = await db.execute({ sql, args });
  return result.rows as T[];
}

export async function run(
  sql: string,
  args: (string | number | null)[] = []
): Promise<void> {
  await db.execute({ sql, args });
}
