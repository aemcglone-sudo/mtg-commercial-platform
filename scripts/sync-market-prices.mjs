/**
 * Speculation Market: daily price snapshot.
 *
 * Downloads Scryfall's "default_cards" bulk file fresh (one row per unique
 * printing, current price included) and upserts one row per printing into
 * market_price_snapshots for today's date. Safe to re-run the same day
 * (upserts on scryfall_id + price_date), and safe to run on a schedule
 * going forward — each run only ever writes today's row.
 *
 * Run manually (or via a daily cron) against production:
 *   fly ssh console -a mtg-deck-builder -C "node scripts/sync-market-prices.mjs"
 *
 * Or locally against a proxied DB:
 *   fly proxy 5432:5432 -a mtg-deck-builder-db   (separate terminal)
 *   DATABASE_URL=postgres://... node scripts/sync-market-prices.mjs
 */

import pg from 'pg';
import { createWriteStream, createReadStream, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray.js';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var required.');
  process.exit(1);
}

const BULK_FILE = '/tmp/scryfall-default-cards-market.json';
const USER_AGENT = 'MTGDeckBuilder/1.0 (+https://mtgdeckfinder.com)';

async function downloadBulkFile() {
  console.log('Fetching bulk-data index…');
  const idxRes = await fetch('https://api.scryfall.com/bulk-data', { headers: { 'User-Agent': USER_AGENT } });
  const idx = await idxRes.json();
  const entry = idx.data.find((d) => d.type === 'default_cards');
  if (!entry) throw new Error('default_cards bulk entry not found');

  console.log(`Downloading ${entry.download_uri} (${(entry.size / 1e6).toFixed(0)} MB)…`);
  const res = await fetch(entry.download_uri, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);

  await pipeline(res.body, createWriteStream(BULK_FILE));
  console.log('Download complete.');
}

async function main() {
  if (!existsSync(BULK_FILE)) {
    await downloadBulkFile();
  } else {
    console.log('Using existing cached bulk file (delete /tmp/scryfall-default-cards-market.json to force a fresh download).');
  }

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const today = new Date().toISOString().slice(0, 10);
  console.log(`Snapshotting prices for ${today}…`);

  let count = 0, written = 0, skipped = 0;

  const pipe = chain([
    createReadStream(BULK_FILE),
    parser(),
    streamArray(),
  ]);

  const insertSql = `
    INSERT INTO market_price_snapshots (id, scryfall_id, card_name, set_code, price_date, usd, usd_foil)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (scryfall_id, price_date) DO UPDATE SET usd = EXCLUDED.usd, usd_foil = EXCLUDED.usd_foil, captured_at = now()
  `;

  let pending = [];
  async function flushPending() {
    if (pending.length === 0) return;
    const rows = pending;
    pending = [];
    for (const row of rows) {
      try {
        await client.query(insertSql, [randomUUID(), row.id, row.name, row.set, today, row.usd, row.usdFoil]);
        written++;
      } catch (e) {
        console.error(`  Insert failed for ${row.name}:`, e.message);
      }
    }
  }

  await new Promise((resolve, reject) => {
    pipe.on('data', ({ value: card }) => {
      count++;
      // Skip non-paper (digital-only) cards and cards with no id/set.
      if (!card.id || !card.set || card.digital) { skipped++; return; }
      const usd = card.prices?.usd ? parseFloat(card.prices.usd) : null;
      const usdFoil = card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null;
      if (usd === null && usdFoil === null) { skipped++; return; }

      pending.push({ id: card.id, name: card.name, set: card.set, usd, usdFoil });

      if (count % 25000 === 0) process.stdout.write(`\r  scanned ${count.toLocaleString()}, queued ${pending.length}…`);
      if (pending.length >= 300) {
        pipe.pause();
        flushPending().then(() => {
          process.stdout.write(`\r  scanned ${count.toLocaleString()}, written ${written.toLocaleString()}…`);
          pipe.resume();
        }).catch(reject);
      }
    });
    pipe.on('end', () => resolve());
    pipe.on('error', reject);
  });
  await flushPending();

  console.log(`\n\nDone. Scanned ${count.toLocaleString()} printings, wrote ${written.toLocaleString()} price rows, skipped ${skipped.toLocaleString()} (no price / digital-only).`);
  await client.end();
}

main().catch((e) => {
  console.error('Sync failed:', e);
  process.exit(1);
});
