ALTER TABLE market_price_snapshots ADD COLUMN IF NOT EXISTS rarity TEXT;
ALTER TABLE market_price_snapshots ADD COLUMN IF NOT EXISTS cmc DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS market_set_release_dates (
  set_code    TEXT PRIMARY KEY,
  released_at DATE,
  updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_signals (
  id                  TEXT PRIMARY KEY,
  scryfall_id         TEXT NOT NULL,
  date                DATE NOT NULL,
  set_code            TEXT NOT NULL,
  rarity              TEXT,
  cmc                 DOUBLE PRECISION,

  days_since_release  INT,
  release_phase       TEXT,

  momentum_7d         DOUBLE PRECISION,
  momentum_30d        DOUBLE PRECISION,
  momentum_90d        DOUBLE PRECISION,
  volatility_7d       DOUBLE PRECISION,
  volatility_30d      DOUBLE PRECISION,

  price_vs_set_median DOUBLE PRECISION,

  current_price       DOUBLE PRECISION,
  price_52w_high      DOUBLE PRECISION,
  price_52w_low       DOUBLE PRECISION,

  created_at          TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (scryfall_id, date)
);
CREATE INDEX IF NOT EXISTS market_signals_scryfall_date_idx ON market_signals (scryfall_id, date);
CREATE INDEX IF NOT EXISTS market_signals_date_momentum_idx ON market_signals (date, momentum_7d);
