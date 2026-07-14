-- Add EUR price cache columns to card_price_snapshots
ALTER TABLE card_price_snapshots
  ADD COLUMN IF NOT EXISTS eur_cents INTEGER,
  ADD COLUMN IF NOT EXISTS eur_foil_cents INTEGER;

-- Add theme_mode to shops (dark/light)
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS theme_mode TEXT NOT NULL DEFAULT 'dark';

-- Reorder storefront sections so inventory comes before hours_location
-- New order: hero(0), about(1), inventory(2), buylist(3), events(4), gallery(5), hours_location(6), social(7), contact(8)
UPDATE shop_site_sections SET sort_order = 2 WHERE section_type = 'inventory';
UPDATE shop_site_sections SET sort_order = 3 WHERE section_type = 'buylist';
UPDATE shop_site_sections SET sort_order = 4 WHERE section_type = 'events';
UPDATE shop_site_sections SET sort_order = 5 WHERE section_type = 'gallery';
UPDATE shop_site_sections SET sort_order = 6 WHERE section_type = 'hours_location';
UPDATE shop_site_sections SET sort_order = 7 WHERE section_type = 'social';
UPDATE shop_site_sections SET sort_order = 8 WHERE section_type = 'contact';

-- Hide the contact section — Hours & Location already shows all contact info
UPDATE shop_site_sections SET visible = false WHERE section_type = 'contact';
