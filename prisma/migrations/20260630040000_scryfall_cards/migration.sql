-- Master card reference table seeded from Scryfall bulk data.
-- One row per oracle card (canonical printing). Read-only at runtime —
-- the app queries this for autocomplete and card lookups.
CREATE TABLE scryfall_cards (
  id TEXT NOT NULL PRIMARY KEY,          -- Scryfall card id (canonical printing)
  oracle_id TEXT NOT NULL,
  name TEXT NOT NULL,
  set_code TEXT NOT NULL,
  set_name TEXT NOT NULL,
  collector_number TEXT NOT NULL,
  rarity TEXT NOT NULL,
  type_line TEXT,
  colors TEXT[],
  color_identity TEXT[],
  cmc NUMERIC,
  mana_cost TEXT,
  oracle_text TEXT,
  power TEXT,
  toughness TEXT,
  image_uri TEXT,
  foil BOOLEAN NOT NULL DEFAULT false,
  nonfoil BOOLEAN NOT NULL DEFAULT true,
  legalities JSONB,
  edhrec_rank INTEGER,
  tcgplayer_id INTEGER,
  released_at DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON scryfall_cards(name);
CREATE INDEX ON scryfall_cards(oracle_id);
CREATE INDEX ON scryfall_cards(set_code);
CREATE INDEX ON scryfall_cards USING gin(colors);
CREATE INDEX ON scryfall_cards USING gin(color_identity);
CREATE INDEX ON scryfall_cards(edhrec_rank);
CREATE INDEX ON scryfall_cards(cmc);
