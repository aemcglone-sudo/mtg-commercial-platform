CREATE TABLE IF NOT EXISTS market_card_news (
  scryfall_id TEXT PRIMARY KEY,
  card_name   TEXT NOT NULL,
  has_news    BOOLEAN NOT NULL DEFAULT false,
  summary     TEXT,
  category    TEXT,
  source_urls TEXT[],
  confidence  DECIMAL(3,2),
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
