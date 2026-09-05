import { run } from '@/lib/db';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

const USER_AGENT = 'MTGDeckBuilder/1.0 (+https://mtgdeckfinder.com)';

export interface SyncResult { scanned: number; written: number; skipped: number; }

/**
 * Daily Speculation Market snapshot: downloads Scryfall's "default_cards"
 * bulk file (gzipped JSONL, refreshed several times a day) and upserts
 * today's price for every printing. Runs in-process (no external script,
 * no extra deps beyond what the app already ships) so it can be triggered
 * by a real scheduled job hitting this logic via an authenticated route.
 * Safe to re-run same-day — upserts on (scryfall_id, price_date).
 */
export async function runDailyPriceSync(): Promise<SyncResult> {
  const idxRes = await fetch('https://api.scryfall.com/bulk-data', { headers: { 'User-Agent': USER_AGENT } });
  if (!idxRes.ok) throw new Error(`bulk-data index fetch failed: ${idxRes.status}`);
  const idx = await idxRes.json();
  const entry = (idx.data as any[]).find((d) => d.type === 'default_cards');
  if (!entry?.jsonl_download_uri) throw new Error('default_cards bulk entry (jsonl_download_uri) not found');

  const res = await fetch(entry.jsonl_download_uri, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`Bulk file download failed: ${res.status}`);

  const today = new Date().toISOString().slice(0, 10);
  const nodeStream = Readable.fromWeb(res.body as any).pipe(createGunzip());
  const rl = createInterface({ input: nodeStream, crlfDelay: Infinity });

  const BATCH_SIZE = 500;
  let batch: { id: string; name: string; set: string; usd: number | null; usdFoil: number | null; rarity: string | null; cmc: number | null; typeLine: string | null }[] = [];
  let scanned = 0, written = 0, skipped = 0;

  async function flush() {
    if (batch.length === 0) return;
    const rows = batch;
    batch = [];
    const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = rows.flatMap((r) => [randomUUID(), r.id, r.name, r.set, today, r.usd, r.usdFoil, r.rarity, r.cmc, r.typeLine]);
    await run(
      `INSERT INTO market_price_snapshots (id, scryfall_id, card_name, set_code, price_date, usd, usd_foil, rarity, cmc, type_line)
       VALUES ${placeholders}
       ON CONFLICT (scryfall_id, price_date) DO UPDATE SET usd = EXCLUDED.usd, usd_foil = EXCLUDED.usd_foil, rarity = EXCLUDED.rarity, cmc = EXCLUDED.cmc, type_line = EXCLUDED.type_line, captured_at = now()`,
      params
    );
    written += rows.length;
  }

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    scanned++;

    let card: any;
    try {
      card = JSON.parse(trimmed);
    } catch {
      skipped++;
      continue;
    }

    if (!card.id || !card.set || card.digital) { skipped++; continue; }
    const usd = card.prices?.usd ? parseFloat(card.prices.usd) : null;
    const usdFoil = card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null;
    if (usd === null && usdFoil === null) { skipped++; continue; }

    const cmc = typeof card.cmc === 'number' ? card.cmc : null;
    const typeLine = typeof card.type_line === 'string' ? card.type_line : null;
    batch.push({ id: card.id, name: card.name, set: card.set, usd, usdFoil, rarity: card.rarity ?? null, cmc, typeLine });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  return { scanned, written, skipped };
}
