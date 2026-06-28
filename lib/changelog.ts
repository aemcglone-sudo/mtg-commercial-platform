import { run } from './db';
import { randomUUID } from 'crypto';

type EntryType = 'feature' | 'fix' | 'infra';

export async function logFeature(type: EntryType, description: string, date?: string): Promise<void> {
  try {
    await run(
      `INSERT INTO product_changelog (id, date, type, description)
       VALUES (?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [randomUUID(), date ?? new Date().toISOString().slice(0, 10), type, description]
    );
  } catch {
    // Never let changelog logging break a feature
  }
}
