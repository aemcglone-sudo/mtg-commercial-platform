/**
 * Speculation Market: daily price snapshot.
 *
 * Downloads Scryfall's "default_cards" bulk file fresh (one row per unique
 * printing, current price included — gzipped JSONL, one card object per
 * line) and upserts one row per printing into market_price_snapshots for
 * today's date. Safe to re-run the same day (upserts on scryfall_id +
 * price_date), and safe to run on a schedule going forward — each run only
 * ever writes today's row.
 *
 * Run manually (or via a daily cron) locally against a proxied DB
 * (the deployed image doesn't ship devDependencies, so this can't run
 * directly on the Fly machine):
 *   fly proxy 5432:5432 -a mtg-deck-builder-db   (separate terminal)
 *   DATABASE_URL=postgres://... node scripts/sync-market-prices.mjs
 */

import pg from 'pg';
import { createWriteStream, createReadStream, existsSync } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var required.');
  process.exit(1);
}

const BULK_FILE_GZ = '/tmp/scryfall-default-cards-market.jsonl.gz';
const USER_AGENT = 'MTGDeckBuilder/1.0 (+https://mtgdeckfinder.com)';

async function downloadBulkFile() {
  console.log('Fetching bulk-data index…');
  const idxRes = await fetch('https://api.scryfall.com/bulk-data', { headers: { 'User-Agent': USER_AGENT } });
  const idx = await idxRes.json();
  const entry = idx.data.find((d) => d.type === 'default_cards');
  if (!entry?.jsonl_download_uri) throw new Error('default_cards bulk entry (jsonl_download_uri) not found');

  console.log(`Downloading ${entry.jsonl_download_uri} (${((entry.compressed_size ?? 0) / 1e6).toFixed(0)} MB compressed)…`);
  const res = await fetch(entry.jsonl_download_uri, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);

  await pipeline(res.body, createWriteStream(BULK_FILE_GZ));
  console.log('Download complete.');
}

async function main() {
  if (!existsSync(BULK_FILE_GZ)) {
    await downloadBulkFile();
  } else {
    console.log(`Using existing cached bulk file (delete ${BULK_FILE_GZ} to force a fresh download).`);
  }

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const today = new Date().toISOString().slice(0, 10);
  console.log(`Snapshotting prices for ${today}…`);

  const BATCH_SIZE = 500;
  let batch = [];
  let count = 0, written = 0, skipped = 0;

  async function flushBatch() {
    if (batch.length === 0) return;
    const rows = batch;
    batch = [];
    const valuesSql = [];
    const params = [];
    let p = 1;
    for (const r of rows) {
      valuesSql.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(randomUUID(), r.id, r.name, r.set, today, r.usd, r.usdFoil);
    }
    const sql = `
      INSERT INTO market_price_snapshots (id, scryfall_id, card_name, set_code, price_date, usd, usd_foil)
      VALUES ${valuesSql.join(', ')}
      ON CONFLICT (scryfall_id, price_date) DO UPDATE SET usd = EXCLUDED.usd, usd_foil = EXCLUDED.usd_foil, captured_at = now()
    `;
    try {
      await client.query(sql, params);
      written += rows.length;
    } catch (e) {
      console.error(`  Batch insert failed (${rows.length} rows):`, e.message);
    }
  }

  const rl = createInterface({
    input: createReadStream(BULK_FILE_GZ).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    count++;

    let card;
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

    batch.push({ id: card.id, name: card.name, set: card.set, usd, usdFoil });
    if (batch.length >= BATCH_SIZE) await flushBatch();

    if (count % 5000 === 0) process.stdout.write(`\r  scanned ${count.toLocaleString()}, written ${written.toLocaleString()}…`);
  }
  await flushBatch();

  console.log(`\n\nDone. Scanned ${count.toLocaleString()} printings, wrote ${written.toLocaleString()} price rows, skipped ${skipped.toLocaleString()} (no price / digital-only / bad line).`);
  await client.end();
}

main().catch((e) => {
  console.error('Sync failed:', e);
  process.exit(1);
});
