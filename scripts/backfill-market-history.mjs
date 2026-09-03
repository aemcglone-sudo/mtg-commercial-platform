/**
 * Speculation Market: ONE-TIME historical backfill.
 *
 * MTGJSON's AllPrices.json carries a rolling 90-day daily price history per
 * card, keyed by MTGJSON's own uuid (not Scryfall's id). AllIdentifiers.json
 * maps that uuid to identifiers.scryfallId, so this script:
 *   1. Streams AllIdentifiers.json.gz -> builds a uuid -> scryfallId map.
 *   2. Streams AllPrices.json.gz -> for each uuid with a mapped scryfallId,
 *      walks paper.tcgplayer.retail.{normal,foil}[date] and batch-inserts
 *      one row per (scryfallId, date) into market_price_snapshots.
 *   3. Uses ON CONFLICT DO NOTHING — never overwrites a row the daily sync
 *      job already wrote for today; this only fills in the past.
 *
 * Run once, locally against a proxied DB:
 *   fly proxy 5432:5432 -a mtg-deck-builder-db   (separate terminal)
 *   DATABASE_URL=postgres://... node scripts/backfill-market-history.mjs
 */

import pg from 'pg';
import { createWriteStream, createReadStream, existsSync } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/pick.js';
import { streamObject } from 'stream-json/streamers/stream-object.js';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var required.');
  process.exit(1);
}

const IDENTIFIERS_FILE = '/tmp/mtgjson-all-identifiers.json.gz';
const PRICES_FILE = '/tmp/mtgjson-all-prices.json.gz';
const BATCH_SIZE = 3000;

async function downloadIfMissing(url, dest) {
  if (existsSync(dest)) {
    console.log(`Using cached ${dest} (delete it to force a fresh download).`);
    return;
  }
  console.log(`Downloading ${url}…`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
  console.log('  done.');
}

async function main() {
  await downloadIfMissing('https://mtgjson.com/api/v5/AllIdentifiers.json.gz', IDENTIFIERS_FILE);
  await downloadIfMissing('https://mtgjson.com/api/v5/AllPrices.json.gz', PRICES_FILE);

  // ── Pass 1: uuid -> {scryfallId, name, setCode} ──────────────────────────
  console.log('\nBuilding uuid -> Scryfall ID map from AllIdentifiers…');
  const idMap = new Map();
  {
    let count = 0;
    const pipe = chain([
      createReadStream(IDENTIFIERS_FILE),
      createGunzip(),
      parser(),
      pick({ filter: 'data' }),
      streamObject(),
    ]);
    await new Promise((resolve, reject) => {
      pipe.on('data', ({ key, value }) => {
        const scryfallId = value?.identifiers?.scryfallId;
        if (scryfallId) idMap.set(key, { scryfallId, name: value.name, setCode: (value.setCode ?? '').toLowerCase() });
        if (++count % 20000 === 0) process.stdout.write(`\r  ${count.toLocaleString()}…`);
      });
      pipe.on('end', resolve);
      pipe.on('error', reject);
    });
    console.log(`\r  ${count.toLocaleString()} entries scanned. Mapped ${idMap.size.toLocaleString()} to Scryfall IDs.`);
  }

  // ── Pass 2: uuid -> price-by-date, batched insert ────────────────────────
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('\nStreaming AllPrices and backfilling history…');
  let scanned = 0, matched = 0, noMap = 0, written = 0;
  let batch = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    const rows = batch;
    batch = [];
    const valuesSql = [];
    const params = [];
    let p = 1;
    for (const r of rows) {
      valuesSql.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(randomUUID(), r.scryfallId, r.name, r.setCode, r.date, r.usd, r.usdFoil);
    }
    const sql = `
      INSERT INTO market_price_snapshots (id, scryfall_id, card_name, set_code, price_date, usd, usd_foil)
      VALUES ${valuesSql.join(', ')}
      ON CONFLICT (scryfall_id, price_date) DO NOTHING
    `;
    try {
      await client.query(sql, params);
      written += rows.length;
    } catch (e) {
      console.error(`  Batch insert failed (${rows.length} rows):`, e.message);
    }
  }

  const pricePipe = chain([
    createReadStream(PRICES_FILE),
    createGunzip(),
    parser(),
    pick({ filter: 'data' }),
    streamObject(),
  ]);

  await new Promise((resolve, reject) => {
    pricePipe.on('data', ({ key: uuid, value: priceObj }) => {
      scanned++;
      const meta = idMap.get(uuid);
      if (!meta) { noMap++; if (scanned % 5000 === 0) process.stdout.write(`\r  scanned ${scanned.toLocaleString()}, queued ${written.toLocaleString()}…`); return; }
      matched++;

      const retail = priceObj?.paper?.tcgplayer?.retail;
      if (retail) {
        const byDate = new Map();
        for (const [date, usd] of Object.entries(retail.normal ?? {})) {
          byDate.set(date, { ...(byDate.get(date) ?? {}), usd: typeof usd === 'number' ? usd : null });
        }
        for (const [date, usdFoil] of Object.entries(retail.foil ?? {})) {
          byDate.set(date, { ...(byDate.get(date) ?? {}), usdFoil: typeof usdFoil === 'number' ? usdFoil : null });
        }
        for (const [date, { usd, usdFoil }] of byDate) {
          batch.push({ scryfallId: meta.scryfallId, name: meta.name, setCode: meta.setCode, date, usd: usd ?? null, usdFoil: usdFoil ?? null });
        }
      }

      if (scanned % 5000 === 0) process.stdout.write(`\r  scanned ${scanned.toLocaleString()}, queued ${written.toLocaleString()}…`);

      if (batch.length >= BATCH_SIZE) {
        pricePipe.pause();
        flushBatch().then(() => pricePipe.resume()).catch(reject);
      }
    });
    pricePipe.on('end', () => resolve());
    pricePipe.on('error', reject);
  });
  await flushBatch();

  console.log(`\n\nDone. Scanned ${scanned.toLocaleString()} priced cards (${matched.toLocaleString()} matched to a Scryfall ID, ${noMap.toLocaleString()} had none), wrote ${written.toLocaleString()} historical price rows.`);
  await client.end();
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
