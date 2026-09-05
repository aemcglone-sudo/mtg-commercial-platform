ALTER TABLE "market_index_snapshots" ADD COLUMN IF NOT EXISTS "concentration_top10_pct" DOUBLE PRECISION;
ALTER TABLE "market_index_snapshots" ADD COLUMN IF NOT EXISTS "concentration_top100_pct" DOUBLE PRECISION;
