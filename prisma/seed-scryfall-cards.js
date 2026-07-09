#!/usr/bin/env node
'use strict';

/**
 * Seeds scryfall_cards from the Scryfall oracle-cards bulk JSON.
 * Run: node /app/prisma/seed-scryfall-cards.js
 *
 * Uses batched multi-row INSERT (500 rows/batch) for speed without
 * requiring pg-copy-streams.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BATCH_SIZE = 500;

const JSON_PATHS = [
  path.join(__dirname, 'oracle-cards-20260629210229.json'),
  '/app/prisma/oracle-cards-20260629210229.json',
];

function findFile() {
  for (const p of JSON_PATHS) if (fs.existsSync(p)) return p;
  throw new Error(`oracle-cards JSON not found. Tried:\n${JSON_PATHS.join('\n')}`);
}

async function insertBatch(rows, retries = 3) {
  if (rows.length === 0) return;
  const cols = 22;
  const placeholders = rows.map((_, ri) =>
    '(' + Array.from({ length: cols }, (_, ci) => `$${ri * cols + ci + 1}`).join(',') + ')'
  ).join(',');
  const values = rows.flat();
  const sql = `INSERT INTO scryfall_cards (
       id, oracle_id, name, set_code, set_name, collector_number,
       rarity, type_line, colors, color_identity, cmc, mana_cost,
       oracle_text, power, toughness, image_uri, foil, nonfoil,
       legalities, edhrec_rank, tcgplayer_id, released_at
     ) VALUES ${placeholders}
     ON CONFLICT (id) DO NOTHING`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await pool.query(sql, values);
      return;
    } catch (e) {
      if (attempt < retries - 1 && (e.message.includes('Connection terminated') || e.message.includes('ECONNRESET'))) {
        console.log(`\n  connection dropped, retrying in 2s…`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  const filePath = findFile();
  console.log(`Reading ${filePath}…`);
  const raw = fs.readFileSync(filePath, 'utf8');
  console.log('Parsing JSON…');
  const cards = JSON.parse(raw);
  console.log(`Loaded ${cards.length} oracle cards`);

  // Create table if it doesn't exist
  const { rows: tableCheck } = await pool.query(
    `SELECT to_regclass('public.scryfall_cards') AS t`
  );
  if (!tableCheck[0].t) {
    console.log('Creating scryfall_cards table…');
    const migSql = fs.readFileSync(
      path.join(__dirname, 'migrations/20260630040000_scryfall_cards/migration.sql'),
      'utf8'
    );
    await pool.query(migSql);
  }

  // Skip cards we already have (allows resuming after disconnect)
  const { rows: existing } = await pool.query('SELECT COUNT(*)::int AS n FROM scryfall_cards');
  const alreadyInserted = existing[0].n;
  if (alreadyInserted > 0) {
    console.log(`Resuming — ${alreadyInserted} rows already present, skipping matching cards…`);
  }

  const { rows: existingIds } = await pool.query('SELECT id FROM scryfall_cards');
  const seenIds = new Set(existingIds.map(r => r.id));

  let batch = [];
  let inserted = 0;
  let skipped = 0;

  for (const c of cards) {
    if (!c.image_uris?.normal) { skipped++; continue; }
    if (seenIds.has(c.id)) { skipped++; continue; }

    batch.push([
      c.id,
      c.oracle_id,
      c.name,
      c.set,
      c.set_name,
      c.collector_number,
      c.rarity,
      c.type_line ?? null,
      c.colors ?? [],
      c.color_identity ?? [],
      c.cmc ?? null,
      c.mana_cost ?? null,
      c.oracle_text ?? null,
      c.power ?? null,
      c.toughness ?? null,
      c.image_uris.normal,
      c.foil ?? false,
      c.nonfoil ?? true,
      c.legalities ? JSON.stringify(c.legalities) : null,
      c.edhrec_rank ?? null,
      c.tcgplayer_id ?? null,
      c.released_at ?? null,
    ]);

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      inserted += batch.length;
      process.stdout.write(`\r  ${alreadyInserted + inserted} / ~${cards.length} inserted…`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    inserted += batch.length;
  }

  console.log(`\nDone — ${inserted} cards seeded, ${skipped} skipped (no image)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
