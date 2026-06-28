CREATE TABLE IF NOT EXISTS format_legality_cache (
  format TEXT PRIMARY KEY,
  ban_list JSONB NOT NULL,
  source_urls TEXT[],
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  confidence DECIMAL(3,2)
);
