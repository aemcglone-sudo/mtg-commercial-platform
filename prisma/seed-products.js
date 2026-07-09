#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run(sql, args = []) {
  let n = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++n}`);
  await pool.query(pgSql, args);
}

async function findOne(sql, args = []) {
  let n = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++n}`);
  const r = await pool.query(pgSql, args);
  return r.rows[0] ?? null;
}

const products = [
  // ── Tarkir: Dragonstorm (TDM) ────────────────────────────────────────────
  { name: 'Tarkir: Dragonstorm Play Booster Box', category: 'booster_box', product_type: 'sealed', set_code: 'TDM', set_name: 'Tarkir: Dragonstorm', release_date: '2025-04-11', msrp_cents: 14499, description: '36 Play Boosters. Return to Tarkir as the clans clash with dragons.' },
  { name: 'Tarkir: Dragonstorm Collector Booster Box', category: 'collector_box', product_type: 'sealed', set_code: 'TDM', set_name: 'Tarkir: Dragonstorm', release_date: '2025-04-11', msrp_cents: 28999, description: '12 Collector Boosters with foil-etched and special-frame cards.' },
  { name: 'Tarkir: Dragonstorm Bundle', category: 'bundle', product_type: 'sealed', set_code: 'TDM', set_name: 'Tarkir: Dragonstorm', release_date: '2025-04-11', msrp_cents: 4499, description: '9 Play Boosters, 40 basic lands, storage box, and accessories.' },
  { name: 'Tarkir: Dragonstorm Commander — Draconic Destruction', category: 'commander_precon', product_type: 'sealed', set_code: 'TDM', set_name: 'Tarkir: Dragonstorm', release_date: '2025-04-11', msrp_cents: 4499, description: 'Ready-to-play 100-card Commander deck.' },
  { name: 'Tarkir: Dragonstorm Commander — Ruthless Ramp', category: 'commander_precon', product_type: 'sealed', set_code: 'TDM', set_name: 'Tarkir: Dragonstorm', release_date: '2025-04-11', msrp_cents: 4499, description: 'Ready-to-play 100-card Commander deck.' },
  { name: 'Tarkir: Dragonstorm Commander — Eternal Might', category: 'commander_precon', product_type: 'sealed', set_code: 'TDM', set_name: 'Tarkir: Dragonstorm', release_date: '2025-04-11', msrp_cents: 4499, description: 'Ready-to-play 100-card Commander deck.' },
  { name: 'Tarkir: Dragonstorm Commander — Controlled Fury', category: 'commander_precon', product_type: 'sealed', set_code: 'TDM', set_name: 'Tarkir: Dragonstorm', release_date: '2025-04-11', msrp_cents: 4499, description: 'Ready-to-play 100-card Commander deck.' },
  { name: 'Tarkir: Dragonstorm Prerelease Kit', category: 'prerelease_kit', product_type: 'sealed', set_code: 'TDM', set_name: 'Tarkir: Dragonstorm', release_date: '2025-04-05', msrp_cents: 2499, description: '6 Set Boosters, promo card, and spindown die.' },
  // ── Final Fantasy (FIN) ───────────────────────────────────────────────────
  { name: 'Final Fantasy Play Booster Box', category: 'booster_box', product_type: 'sealed', set_code: 'FIN', set_name: 'Final Fantasy', release_date: '2025-06-13', msrp_cents: 14499, description: '36 Play Boosters featuring the worlds of Final Fantasy.' },
  { name: 'Final Fantasy Collector Booster Box', category: 'collector_box', product_type: 'sealed', set_code: 'FIN', set_name: 'Final Fantasy', release_date: '2025-06-13', msrp_cents: 28999, description: '12 Collector Boosters with scene cards, foil-etched treatments, and serialized cards.' },
  { name: 'Final Fantasy Bundle', category: 'bundle', product_type: 'sealed', set_code: 'FIN', set_name: 'Final Fantasy', release_date: '2025-06-13', msrp_cents: 4499, description: '9 Play Boosters, 40 basic lands, and accessories.' },
  { name: 'Final Fantasy Commander — Warriors of Light', category: 'commander_precon', product_type: 'sealed', set_code: 'FIN', set_name: 'Final Fantasy', release_date: '2025-06-13', msrp_cents: 4499, description: '100-card Commander deck themed around Final Fantasy heroes.' },
  { name: 'Final Fantasy Commander — Forces of Chaos', category: 'commander_precon', product_type: 'sealed', set_code: 'FIN', set_name: 'Final Fantasy', release_date: '2025-06-13', msrp_cents: 4499, description: '100-card Commander deck themed around Final Fantasy villains.' },
  // ── Foundations (FDN) ────────────────────────────────────────────────────
  { name: 'Foundations Play Booster Box', category: 'booster_box', product_type: 'sealed', set_code: 'FDN', set_name: 'Foundations', release_date: '2024-11-15', msrp_cents: 14499, description: '36 Play Boosters. The ultimate beginner-friendly set with evergreen staples.' },
  { name: 'Foundations Collector Booster Box', category: 'collector_box', product_type: 'sealed', set_code: 'FDN', set_name: 'Foundations', release_date: '2024-11-15', msrp_cents: 28999, description: '12 Collector Boosters featuring anime-art treatments.' },
  { name: 'Foundations Starter Kit', category: 'starter_deck', product_type: 'sealed', set_code: 'FDN', set_name: 'Foundations', release_date: '2024-11-15', msrp_cents: 1499, description: 'Two 60-card decks for teaching new players.' },
  { name: 'Foundations Commander — Grave Danger', category: 'commander_precon', product_type: 'sealed', set_code: 'FDN', set_name: 'Foundations', release_date: '2024-11-15', msrp_cents: 4499 },
  { name: 'Foundations Commander — Divine Convocation', category: 'commander_precon', product_type: 'sealed', set_code: 'FDN', set_name: 'Foundations', release_date: '2024-11-15', msrp_cents: 4499 },
  // ── Duskmourn: House of Horror (DSK) ────────────────────────────────────
  { name: 'Duskmourn: House of Horror Play Booster Box', category: 'booster_box', product_type: 'sealed', set_code: 'DSK', set_name: 'Duskmourn: House of Horror', release_date: '2024-09-27', msrp_cents: 14499, description: '36 Play Boosters. Survive the horrors of the House.' },
  { name: 'Duskmourn: House of Horror Collector Booster Box', category: 'collector_box', product_type: 'sealed', set_code: 'DSK', set_name: 'Duskmourn: House of Horror', release_date: '2024-09-27', msrp_cents: 28999 },
  { name: 'Duskmourn: House of Horror Bundle', category: 'bundle', product_type: 'sealed', set_code: 'DSK', set_name: 'Duskmourn: House of Horror', release_date: '2024-09-27', msrp_cents: 4499 },
  { name: 'Duskmourn Commander — Endless Punishment', category: 'commander_precon', product_type: 'sealed', set_code: 'DSK', set_name: 'Duskmourn: House of Horror', release_date: '2024-09-27', msrp_cents: 4499 },
  { name: 'Duskmourn Commander — Jump Scare!', category: 'commander_precon', product_type: 'sealed', set_code: 'DSK', set_name: 'Duskmourn: House of Horror', release_date: '2024-09-27', msrp_cents: 4499 },
  { name: 'Duskmourn Commander — Disturbing Behavior', category: 'commander_precon', product_type: 'sealed', set_code: 'DSK', set_name: 'Duskmourn: House of Horror', release_date: '2024-09-27', msrp_cents: 4499 },
  { name: 'Duskmourn Commander — Deadly Disguise', category: 'commander_precon', product_type: 'sealed', set_code: 'DSK', set_name: 'Duskmourn: House of Horror', release_date: '2024-09-27', msrp_cents: 4499 },
  // ── Bloomburrow (BLB) ────────────────────────────────────────────────────
  { name: 'Bloomburrow Play Booster Box', category: 'booster_box', product_type: 'sealed', set_code: 'BLB', set_name: 'Bloomburrow', release_date: '2024-08-02', msrp_cents: 14499, description: '36 Play Boosters. A world of charming anthropomorphic animals.' },
  { name: 'Bloomburrow Collector Booster Box', category: 'collector_box', product_type: 'sealed', set_code: 'BLB', set_name: 'Bloomburrow', release_date: '2024-08-02', msrp_cents: 28999 },
  { name: 'Bloomburrow Bundle', category: 'bundle', product_type: 'sealed', set_code: 'BLB', set_name: 'Bloomburrow', release_date: '2024-08-02', msrp_cents: 4499 },
  { name: 'Bloomburrow Commander — Animated Army', category: 'commander_precon', product_type: 'sealed', set_code: 'BLB', set_name: 'Bloomburrow', release_date: '2024-08-02', msrp_cents: 4499 },
  { name: 'Bloomburrow Commander — Squirreled Away', category: 'commander_precon', product_type: 'sealed', set_code: 'BLB', set_name: 'Bloomburrow', release_date: '2024-08-02', msrp_cents: 4499 },
  { name: 'Bloomburrow Commander — Peace Offering', category: 'commander_precon', product_type: 'sealed', set_code: 'BLB', set_name: 'Bloomburrow', release_date: '2024-08-02', msrp_cents: 4499 },
  { name: 'Bloomburrow Commander — Family Matters', category: 'commander_precon', product_type: 'sealed', set_code: 'BLB', set_name: 'Bloomburrow', release_date: '2024-08-02', msrp_cents: 4499 },
  // ── Modern Horizons 3 (MH3) ──────────────────────────────────────────────
  { name: 'Modern Horizons 3 Play Booster Box', category: 'booster_box', product_type: 'sealed', set_code: 'MH3', set_name: 'Modern Horizons 3', release_date: '2024-06-14', msrp_cents: 22999, description: '36 Play Boosters. Powerful cards that skip Standard and go straight to Modern.' },
  { name: 'Modern Horizons 3 Collector Booster Box', category: 'collector_box', product_type: 'sealed', set_code: 'MH3', set_name: 'Modern Horizons 3', release_date: '2024-06-14', msrp_cents: 37999, description: '12 Collector Boosters. Foil-etched and special-frame cards.' },
  { name: 'Modern Horizons 3 Bundle', category: 'bundle', product_type: 'sealed', set_code: 'MH3', set_name: 'Modern Horizons 3', release_date: '2024-06-14', msrp_cents: 4999 },
  { name: 'Modern Horizons 3 Commander — Creative Energy', category: 'commander_precon', product_type: 'sealed', set_code: 'MH3', set_name: 'Modern Horizons 3', release_date: '2024-06-14', msrp_cents: 4499 },
  { name: 'Modern Horizons 3 Commander — Eldrazi Incursion', category: 'commander_precon', product_type: 'sealed', set_code: 'MH3', set_name: 'Modern Horizons 3', release_date: '2024-06-14', msrp_cents: 4499 },
  { name: 'Modern Horizons 3 Commander — Graveyard Overdrive', category: 'commander_precon', product_type: 'sealed', set_code: 'MH3', set_name: 'Modern Horizons 3', release_date: '2024-06-14', msrp_cents: 4499 },
  { name: 'Modern Horizons 3 Commander — Tricky Terrain', category: 'commander_precon', product_type: 'sealed', set_code: 'MH3', set_name: 'Modern Horizons 3', release_date: '2024-06-14', msrp_cents: 4499 },
  // ── Murders at Karlov Manor (MKM) ────────────────────────────────────────
  { name: 'Murders at Karlov Manor Play Booster Box', category: 'booster_box', product_type: 'sealed', set_code: 'MKM', set_name: 'Murders at Karlov Manor', release_date: '2024-02-09', msrp_cents: 14499 },
  { name: 'Murders at Karlov Manor Collector Booster Box', category: 'collector_box', product_type: 'sealed', set_code: 'MKM', set_name: 'Murders at Karlov Manor', release_date: '2024-02-09', msrp_cents: 28999 },
  { name: 'Murders at Karlov Manor Commander — Blame Game', category: 'commander_precon', product_type: 'sealed', set_code: 'MKM', set_name: 'Murders at Karlov Manor', release_date: '2024-02-09', msrp_cents: 4499 },
  { name: 'Murders at Karlov Manor Commander — Deep Clue Sea', category: 'commander_precon', product_type: 'sealed', set_code: 'MKM', set_name: 'Murders at Karlov Manor', release_date: '2024-02-09', msrp_cents: 4499 },
  { name: 'Murders at Karlov Manor Commander — Deadly Disguise', category: 'commander_precon', product_type: 'sealed', set_code: 'MKM', set_name: 'Murders at Karlov Manor', release_date: '2024-02-09', msrp_cents: 4499 },
  { name: 'Murders at Karlov Manor Commander — Revenant Recon', category: 'commander_precon', product_type: 'sealed', set_code: 'MKM', set_name: 'Murders at Karlov Manor', release_date: '2024-02-09', msrp_cents: 4499 },
  // ── Outlaws of Thunder Junction (OTJ) ────────────────────────────────────
  { name: 'Outlaws of Thunder Junction Play Booster Box', category: 'booster_box', product_type: 'sealed', set_code: 'OTJ', set_name: 'Outlaws of Thunder Junction', release_date: '2024-04-19', msrp_cents: 14499 },
  { name: 'Outlaws of Thunder Junction Collector Booster Box', category: 'collector_box', product_type: 'sealed', set_code: 'OTJ', set_name: 'Outlaws of Thunder Junction', release_date: '2024-04-19', msrp_cents: 28999 },
  { name: 'Outlaws of Thunder Junction Commander — Desert Bloom', category: 'commander_precon', product_type: 'sealed', set_code: 'OTJ', set_name: 'Outlaws of Thunder Junction', release_date: '2024-04-19', msrp_cents: 4499 },
  { name: 'Outlaws of Thunder Junction Commander — Grand Larceny', category: 'commander_precon', product_type: 'sealed', set_code: 'OTJ', set_name: 'Outlaws of Thunder Junction', release_date: '2024-04-19', msrp_cents: 4499 },
  { name: 'Outlaws of Thunder Junction Commander — Most Wanted', category: 'commander_precon', product_type: 'sealed', set_code: 'OTJ', set_name: 'Outlaws of Thunder Junction', release_date: '2024-04-19', msrp_cents: 4499 },
  { name: 'Outlaws of Thunder Junction Commander — Quick Draw', category: 'commander_precon', product_type: 'sealed', set_code: 'OTJ', set_name: 'Outlaws of Thunder Junction', release_date: '2024-04-19', msrp_cents: 4499 },
  // ── Accessories ──────────────────────────────────────────────────────────
  { name: 'Dragon Shield Classic Sleeves (100 ct) — Matte Black', category: 'sleeve', product_type: 'accessory', msrp_cents: 1199, description: 'Standard size (63×88mm). Archival-safe polypropylene.' },
  { name: 'Dragon Shield Classic Sleeves (100 ct) — Matte White', category: 'sleeve', product_type: 'accessory', msrp_cents: 1199 },
  { name: 'Dragon Shield Classic Sleeves (100 ct) — Matte Blue', category: 'sleeve', product_type: 'accessory', msrp_cents: 1199 },
  { name: 'Dragon Shield Classic Sleeves (100 ct) — Matte Red', category: 'sleeve', product_type: 'accessory', msrp_cents: 1199 },
  { name: 'Dragon Shield Art Sleeves (100 ct)', category: 'sleeve', product_type: 'accessory', msrp_cents: 1299, description: 'Licensed artwork on the back. Standard size.' },
  { name: 'Ultimate Guard Katana Sleeves (100 ct) — Clear', category: 'sleeve', product_type: 'accessory', msrp_cents: 999, description: 'Standard size sleeves with crystal-clear back.' },
  { name: 'Ultimate Guard Katana Sleeves (100 ct) — Black', category: 'sleeve', product_type: 'accessory', msrp_cents: 999 },
  { name: 'KMC Hyper Mat Sleeves (80 ct) — Black', category: 'sleeve', product_type: 'accessory', msrp_cents: 899, description: 'Popular Japanese-import sleeves with excellent durability.' },
  { name: 'KMC Hyper Mat Sleeves (80 ct) — White', category: 'sleeve', product_type: 'accessory', msrp_cents: 899 },
  { name: 'Dragon Shield Nest Box 300 — Black', category: 'deck_box', product_type: 'accessory', msrp_cents: 2499, description: 'Holds 300 double-sleeved cards. Magnetic closure.' },
  { name: 'Ultimate Guard Flip n Tray 100+ — Xenoskin Black', category: 'deck_box', product_type: 'accessory', msrp_cents: 2999, description: 'Side-loading deck box with flip tray.' },
  { name: 'BCW Gaming Card House Box — Holds 1600', category: 'storage_box', product_type: 'accessory', msrp_cents: 499, description: 'Corrugated storage for bulk collection.' },
  { name: 'Ultimate Guard Omnihive 480+ Card Hive', category: 'storage_box', product_type: 'accessory', msrp_cents: 4999, description: 'Modular stackable storage holds 480+ sleeved cards.' },
  { name: 'Inked Gaming MTG Playmat — Standard (24"×14")', category: 'playmat', product_type: 'accessory', msrp_cents: 1999, description: 'Custom printed neoprene playmat, standard MTG size.' },
  { name: 'Ultra Pro Eclipse Playmat — Black', category: 'playmat', product_type: 'accessory', msrp_cents: 2499, description: 'Textured, stitched-edge neoprene playmat.' },
  { name: 'Dragon Shield Playmat — Matte Black', category: 'playmat', product_type: 'accessory', msrp_cents: 2499, description: 'Premium rubber playmat with stitched edges.' },
  { name: 'Ultra Pro 9-Pocket Binder (360 ct)', category: 'binder', product_type: 'accessory', msrp_cents: 1499, description: 'D-ring binder with 9-pocket pages. Holds 360 cards in sleeves.' },
  { name: 'Dragon Shield Card Codex Zipster Binder — Black', category: 'binder', product_type: 'accessory', msrp_cents: 2999, description: 'Zip-close binder with 8-pocket pages. Holds 480 cards.' },
  { name: 'Chessex Gemini Polyhedral Dice Set (7 ct)', category: 'dice', product_type: 'accessory', msrp_cents: 999, description: 'Full 7-die polyhedral set.' },
  { name: 'Spindown d20 Life Counter — MTG Official', category: 'dice', product_type: 'accessory', msrp_cents: 299, description: 'Single oversized d20 for tracking Commander life totals.' },
  { name: 'Ultra Pro Life Counter Dial — Two Wheel', category: 'other_accessory', product_type: 'accessory', msrp_cents: 399, description: 'Dual rotating dials track life totals 0–99.' },
  { name: 'Card Saver I Semi-Rigid Card Holders (200 ct)', category: 'other_accessory', product_type: 'accessory', msrp_cents: 1499, description: 'Industry-standard semi-rigid holders for grading and shipping.' },
];

async function main() {
  console.log(`Seeding ${products.length} products…`);
  let inserted = 0;
  let skipped = 0;

  for (const p of products) {
    const existing = await findOne('SELECT id FROM mtg_products WHERE name = $1', [p.name]);
    if (existing) { skipped++; continue; }

    await run(
      `INSERT INTO mtg_products
         (id, name, category, product_type, set_code, set_name, release_date, msrp_cents, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [
        randomUUID(),
        p.name,
        p.category,
        p.product_type,
        p.set_code ?? null,
        p.set_name ?? null,
        p.release_date ?? null,
        p.msrp_cents ?? null,
        p.description ?? null,
      ]
    );
    inserted++;
  }

  console.log(`Done — ${inserted} inserted, ${skipped} skipped`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
