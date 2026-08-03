-- Pin collection cards to a specific Scryfall printing (set/collector number/finish)
-- instead of relying on an arbitrary name-only lookup for pricing/images.
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "scryfallId" TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "setCode" TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "collectorNumber" TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS finish TEXT;
