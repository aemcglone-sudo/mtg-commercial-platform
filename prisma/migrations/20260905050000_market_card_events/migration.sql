CREATE TABLE IF NOT EXISTS "market_card_events" (
  "id" TEXT PRIMARY KEY,
  "scryfall_id" TEXT NOT NULL,
  "card_name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "source_urls" TEXT[] NOT NULL DEFAULT '{}',
  "confidence" DOUBLE PRECISION,
  "price_at_detection" DOUBLE PRECISION,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "market_card_events_scryfall_id_detected_at_idx" ON "market_card_events" ("scryfall_id", "detected_at");
CREATE INDEX IF NOT EXISTS "market_card_events_detected_at_idx" ON "market_card_events" ("detected_at");
