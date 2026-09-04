CREATE TABLE IF NOT EXISTS market_movers_cache (
  id           TEXT PRIMARY KEY,
  cache_key    TEXT NOT NULL UNIQUE,
  payload      JSONB NOT NULL,
  computed_at  TIMESTAMP NOT NULL DEFAULT now()
);
