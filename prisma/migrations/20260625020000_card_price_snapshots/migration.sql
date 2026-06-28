CREATE TABLE IF NOT EXISTS card_price_snapshots (
  id TEXT PRIMARY KEY,
  "scryfallId" TEXT NOT NULL,
  "cardName" TEXT,
  "priceCents" INTEGER,
  "foilPriceCents" INTEGER,
  "capturedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_scryfall_captured
  ON card_price_snapshots("scryfallId", "capturedAt" DESC);
