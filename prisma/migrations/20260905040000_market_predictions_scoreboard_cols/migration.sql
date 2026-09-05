-- Denormalized card_name/set_code so the Speculation Scoreboard doesn't need
-- to join market_predictions against market_price_snapshots on every page
-- load (that join was measured at ~6s across 85k+ rows).
ALTER TABLE "market_predictions" ADD COLUMN IF NOT EXISTS "card_name" TEXT;
ALTER TABLE "market_predictions" ADD COLUMN IF NOT EXISTS "set_code" TEXT;

CREATE INDEX IF NOT EXISTS "market_predictions_date_prediction_direction_confidence_pct_idx"
  ON "market_predictions" ("date", "prediction_direction", "confidence_pct");
