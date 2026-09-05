CREATE TABLE IF NOT EXISTS "market_index_snapshots" (
  "date" DATE PRIMARY KEY,
  "index_value" DOUBLE PRECISION NOT NULL,
  "card_count" INTEGER NOT NULL,
  "advancers" INTEGER,
  "decliners" INTEGER,
  "unchanged" INTEGER,
  "median_return_pct" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);
