/**
 * Backfills collectorNumber, setCode, imageUrl for all shop_inventory rows
 * using Scryfall's pre-downloaded default_cards bulk JSON (streamed).
 *
 * Prerequisites:
 *   fly proxy 5432:5432 -a mtg-deck-builder-db  (separate terminal)
 *   /tmp/scryfall-default-cards.json             (530 MB, already downloaded)
 *
 * Run:
 *   node scripts/backfill-collector-numbers.mjs
 */

import pg from 'pg';
import { createReadStream } from 'fs';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray.js';

const DB = 'postgres://mtg_deck_builder:4Zpy1Vc1WZkufR1@localhost:5432/mtg_deck_builder?sslmode=disable';
const CACHE = '/tmp/scryfall-default-cards.json';

// ── 1. Stream bulk data into lookup map ──────────────────────────────────────
console.log('Streaming Scryfall bulk data…');
const lookup = new Map();

await new Promise((resolve, reject) => {
  const pipeline = chain([
    createReadStream(CACHE),
    parser(),
    streamArray(),
  ]);

  let count = 0;
  pipeline.on('data', ({ value: card }) => {
    if (card.id) {
      lookup.set(card.id, {
        collectorNumber: card.collector_number ?? null,
        setCode: card.set ?? null,
        imageUrl: card.image_uris?.border_crop ?? card.image_uris?.normal ?? null,
      });
    }
    if (++count % 50000 === 0) process.stdout.write(`\r  ${count.toLocaleString()} cards…`);
  });
  pipeline.on('end', resolve);
  pipeline.on('error', reject);
});

console.log(`\nLookup map: ${lookup.size.toLocaleString()} entries`);

// ── 2. Fetch all inventory rows ───────────────────────────────────────────────
const client = new pg.Client({ connectionString: DB });
await client.connect();

const { rows } = await client.query(
  `SELECT id, "scryfallId" FROM shop_inventory ORDER BY id`
);
console.log(`Inventory rows to process: ${rows.length.toLocaleString()}`);

// ── 3. Batch UPDATE ───────────────────────────────────────────────────────────
let updated = 0, skipped = 0;
const BATCH = 200;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);

  for (const row of batch) {
    const data = lookup.get(row.scryfallId);
    if (!data) { skipped++; continue; }

    await client.query(
      `UPDATE shop_inventory SET
         "collectorNumber" = $1,
         "setCode"         = COALESCE("setCode", $2),
         "imageUrl"        = COALESCE("imageUrl", $3)
       WHERE id = $4`,
      [data.collectorNumber, data.setCode, data.imageUrl, row.id]
    );
    updated++;
  }

  process.stdout.write(`\r  ${Math.min(i + BATCH, rows.length)} / ${rows.length}  (updated: ${updated}, no match: ${skipped})`);
}

console.log(`\n\nDone.`);
console.log(`  Updated : ${updated.toLocaleString()}`);
console.log(`  No match: ${skipped.toLocaleString()}`);

await client.end();
