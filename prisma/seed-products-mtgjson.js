#!/usr/bin/env node
'use strict';

/**
 * Seeds mtg_products from MTGJSON's sealedProduct data.
 * Fetches all sets released since MIN_YEAR, pulls sealedProduct[] per set,
 * maps to our category schema, and upserts into mtg_products.
 * Safe to re-run — skips existing products by name.
 */

const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MIN_YEAR = 2022;
const BASE = 'https://mtgjson.com/api/v5';
const DELAY_MS = 300; // be polite to MTGJSON

// ── Category mapping ──────────────────────────────────────────────────────────
// MTGJSON sealedProduct.category → our DB category
// MTGJSON uses snake_case categories
const CATEGORY_MAP = {
  'booster_box':        'booster_box',
  'collector_box':      'collector_box',
  'bundle':             'bundle',
  'deck':               'commander_precon',   // commander decks
  'limited_aid_tool':   'prerelease_kit',     // prerelease packs
  'multiple_decks':     'starter_deck',       // starter kits
  'booster_pack':       'booster_pack',
  'box_set':            'bundle',             // scene boxes, gift sets
  // Skip: bundle_case, booster_case, limited_aid_case, deck_box, subset (cases/sets of sets)
};

// Set types worth stocking in a retail store
const INCLUDED_SET_TYPES = new Set([
  'expansion',
  'core',
  'masters',
  'draft_innovation',
  'commander',
  'planechase',
  'archenemy',
  'starter',
  'box',
  'funny',      // Unstable, Unfinity, etc.
]);

// ── DB helpers ────────────────────────────────────────────────────────────────
async function dbRun(sql, args = []) {
  let n = 0;
  const pg = sql.replace(/\?/g, () => `$${++n}`);
  await pool.query(pg, args);
}

async function dbFind(sql, args = []) {
  let n = 0;
  const pg = sql.replace(/\?/g, () => `$${++n}`);
  const r = await pool.query(pg, args);
  return r.rows[0] ?? null;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Grimoire/1.0 (grimoire.gg; sealed-product-seeder)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── MSRP lookup (best-effort from purchaseUrls or known values) ───────────────
// MTGJSON doesn't provide MSRP directly; we derive from category
const MSRP_BY_CATEGORY = {
  booster_box:       14499,
  collector_box:     28999,
  bundle:             4499,
  commander_precon:   4499,
  prerelease_kit:     2499,
  starter_deck:       1499,
  jumpstart:         14499,
  secret_lair:        2999,  // varies widely
  commander_collection: 9999,
  anthology:         16999,
  booster_pack:        499,
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching set list from MTGJSON…');
  const setListData = await fetchJson(`${BASE}/SetList.json`);
  const allSets = setListData.data ?? [];

  // Filter to sets we care about
  const sets = allSets.filter(s => {
    if (!s.releaseDate) return false;
    if (parseInt(s.releaseDate.slice(0, 4)) < MIN_YEAR) return false;
    if (!INCLUDED_SET_TYPES.has(s.type)) return false;
    // Skip tokens, promos, memorabilia
    if (['token', 'promo', 'memorabilia', 'treasure_chest', 'minigame', 'vanguard'].includes(s.type)) return false;
    return true;
  });

  console.log(`Found ${sets.length} sets from ${MIN_YEAR}+ to process`);

  let inserted = 0;
  let skipped = 0;
  let setsWithProducts = 0;

  for (const setMeta of sets) {
    await sleep(DELAY_MS);
    let setData;
    try {
      const envelope = await fetchJson(`${BASE}/${setMeta.code}.json`);
      setData = envelope.data;
    } catch (e) {
      console.warn(`  ⚠ Could not fetch ${setMeta.code}: ${e.message}`);
      continue;
    }

    const products = setData.sealedProduct ?? [];
    if (products.length === 0) continue;

    setsWithProducts++;
    console.log(`  ${setMeta.code} — ${setMeta.name} (${products.length} products)`);

    for (const p of products) {
      const rawCategory = p.category ?? '';
      const category = CATEGORY_MAP[rawCategory];

      if (!category) {
        // Skip unknown categories (promo packs, art series, etc.)
        continue;
      }

      const name = p.name?.trim();
      if (!name) continue;

      // Check if already exists
      const existing = await dbFind('SELECT id FROM mtg_products WHERE name = ?', [name]);
      if (existing) { skipped++; continue; }

      const tcgplayerId = p.identifiers?.tcgplayerProductId ?? null;
      // Refine booster_box → collector_box based on name
      const finalCategory = (category === 'booster_box' && /collector/i.test(name))
        ? 'collector_box'
        : category;
      const msrp = MSRP_BY_CATEGORY[finalCategory] ?? null;

      await dbRun(
        `INSERT INTO mtg_products
           (id, name, category, product_type, set_code, set_name, release_date,
            msrp_cents, tcgplayer_product_id, is_active)
         VALUES (?, ?, ?, 'sealed', ?, ?, ?, ?, ?, true)`,
        [
          randomUUID(),
          name,
          finalCategory,
          setMeta.code,
          setMeta.name,
          setMeta.releaseDate ?? null,
          msrp,
          tcgplayerId,
        ]
      );
      inserted++;
    }
  }

  console.log(`\nDone — ${setsWithProducts} sets processed`);
  console.log(`  ${inserted} products inserted`);
  console.log(`  ${skipped} skipped (already exist)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
