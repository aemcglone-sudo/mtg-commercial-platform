CREATE TABLE IF NOT EXISTS market_patterns (
  id                   TEXT PRIMARY KEY,
  pattern_name         TEXT NOT NULL UNIQUE,
  description          TEXT NOT NULL,
  predicted_pct_change DOUBLE PRECISION NOT NULL,
  confidence_pct       DOUBLE PRECISION NOT NULL,
  priority             INT NOT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_predictions (
  id                    TEXT PRIMARY KEY,
  scryfall_id           TEXT NOT NULL,
  date                  DATE NOT NULL,

  current_price         DOUBLE PRECISION,
  target_price_6m       DOUBLE PRECISION,
  target_price_6m_low   DOUBLE PRECISION,
  target_price_6m_high  DOUBLE PRECISION,
  confidence_pct        DOUBLE PRECISION,
  prediction_direction  TEXT,
  matched_pattern       TEXT,
  dominant_signals      JSONB,

  upside_scenario       TEXT,
  upside_target         DOUBLE PRECISION,
  downside_scenario     TEXT,
  downside_target       DOUBLE PRECISION,
  risk_factors          JSONB,

  created_at            TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (scryfall_id, date)
);
CREATE INDEX IF NOT EXISTS market_predictions_scryfall_date_idx ON market_predictions (scryfall_id, date);
