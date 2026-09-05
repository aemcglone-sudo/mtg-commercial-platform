-- Already created directly on production via CREATE INDEX CONCURRENTLY
-- (to avoid a write lock on a 1M+ row table); this is IF NOT EXISTS so
-- `prisma migrate deploy` is a no-op there and a real CREATE on fresh DBs.
CREATE INDEX IF NOT EXISTS "market_price_snapshots_card_name_idx" ON "market_price_snapshots" ("card_name");
