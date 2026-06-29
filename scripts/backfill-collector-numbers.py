#!/usr/bin/env python3
"""
Backfills collectorNumber and fixes scryfallId using real Scryfall UUIDs
extracted from each row's imageUrl.

Run:
  python3 scripts/backfill-collector-numbers.py
"""

import re, ijson, psycopg2
from pathlib import Path

DB    = "postgres://mtg_deck_builder:4Zpy1Vc1WZkufR1@localhost:5432/mtg_deck_builder?sslmode=disable"
CACHE = Path("/tmp/scryfall-default-cards.json")
UUID_RE = re.compile(r'/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')

# ── 1. Stream bulk data into lookup ──────────────────────────────────────────
print("Streaming Scryfall bulk data…")
lookup = {}  # real_uuid → {collector_number, set_name}

with open(CACHE, "rb") as f:
    count = 0
    for card in ijson.items(f, "item"):
        cid = card.get("id")
        if cid:
            lookup[cid] = {
                "collectorNumber": card.get("collector_number"),
                "setName": card.get("set_name"),
            }
        count += 1
        if count % 50000 == 0:
            print(f"  {count:,} cards…", end="\r", flush=True)

print(f"\nLookup: {len(lookup):,} entries")

# ── 2. Fetch inventory rows ──────────────────────────────────────────────────
conn = psycopg2.connect(DB)
cur  = conn.cursor()

cur.execute('SELECT id, "scryfallId", "imageUrl" FROM shop_inventory ORDER BY id')
rows = cur.fetchall()
print(f"Inventory rows: {len(rows):,}")

# ── 3. Update each row ────────────────────────────────────────────────────────
updated = 0
skipped = 0

for row_id, fake_id, image_url in rows:
    m = UUID_RE.search(image_url or "")
    if not m:
        skipped += 1
        continue

    real_id = m.group(1)
    data = lookup.get(real_id)
    if not data:
        skipped += 1
        continue

    cur.execute(
        '''UPDATE shop_inventory SET
             "scryfallId"      = %s,
             "collectorNumber" = %s
           WHERE id = %s''',
        (real_id, data["collectorNumber"], row_id)
    )
    updated += 1

conn.commit()
print(f"\nDone.  Updated: {updated:,}  Skipped: {skipped:,}")

# ── 4. Verify ─────────────────────────────────────────────────────────────────
cur.execute('SELECT "scryfallId", "collectorNumber", "cardName" FROM shop_inventory LIMIT 5')
print("\nSample after backfill:")
for r in cur.fetchall():
    print(f"  {r[0]}  #{r[1]}  {r[2]}")

cur.close()
conn.close()
