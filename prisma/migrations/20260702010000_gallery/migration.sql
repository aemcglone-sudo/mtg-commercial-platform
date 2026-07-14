-- Add thumbnail_url and updated_at to the existing shop_gallery_images table
ALTER TABLE shop_gallery_images
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill thumbnail_url = image_url for existing rows
UPDATE shop_gallery_images SET thumbnail_url = image_url WHERE thumbnail_url IS NULL;

-- Now make it NOT NULL
ALTER TABLE shop_gallery_images ALTER COLUMN thumbnail_url SET NOT NULL;

-- Rename index if old one exists (harmless if not)
CREATE INDEX IF NOT EXISTS idx_shop_gallery_shop_order ON shop_gallery_images(shop_id, sort_order);
