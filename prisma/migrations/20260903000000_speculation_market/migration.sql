CREATE TABLE IF NOT EXISTS market_price_snapshots (
  id           TEXT PRIMARY KEY,
  scryfall_id  TEXT NOT NULL,
  card_name    TEXT NOT NULL,
  set_code     TEXT NOT NULL,
  price_date   DATE NOT NULL,
  usd          DOUBLE PRECISION,
  usd_foil     DOUBLE PRECISION,
  captured_at  TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (scryfall_id, price_date)
);
CREATE INDEX IF NOT EXISTS market_price_snapshots_scryfall_date_idx ON market_price_snapshots (scryfall_id, price_date);
CREATE INDEX IF NOT EXISTS market_price_snapshots_set_date_idx ON market_price_snapshots (set_code, price_date);

CREATE TABLE IF NOT EXISTS market_watchlist_items (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  scryfall_id TEXT,
  card_name   TEXT,
  set_code    TEXT,
  set_name    TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, scryfall_id, set_code)
);
CREATE INDEX IF NOT EXISTS market_watchlist_items_user_idx ON market_watchlist_items (user_id);
