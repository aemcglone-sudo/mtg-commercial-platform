-- Extend shops table with storefront fields
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS site_status       TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS template          TEXT NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS theme_primary_hex TEXT NOT NULL DEFAULT '#1A1A2E',
  ADD COLUMN IF NOT EXISTS theme_accent_hex  TEXT NOT NULL DEFAULT '#F5A623',
  ADD COLUMN IF NOT EXISTS font_pairing      TEXT NOT NULL DEFAULT 'classic_serif',
  ADD COLUMN IF NOT EXISTS about_text        TEXT,
  ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS social_links      JSONB NOT NULL DEFAULT '{}';

-- Site sections (visibility + order per shop)
CREATE TABLE IF NOT EXISTS shop_site_sections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  visible      BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL,
  config       JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, section_type)
);

CREATE INDEX IF NOT EXISTS idx_shop_site_sections_shop ON shop_site_sections(shop_id);

-- Gallery images
CREATE TABLE IF NOT EXISTS shop_gallery_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  caption    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_gallery_images_shop ON shop_gallery_images(shop_id);

-- Custom domains
CREATE TABLE IF NOT EXISTS shop_custom_domains (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE UNIQUE,
  domain             TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending',
  verification_token TEXT NOT NULL,
  dns_record_type    TEXT,
  dns_target         TEXT,
  last_checked_at    TIMESTAMPTZ,
  verified_at        TIMESTAMPTZ,
  failure_reason     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_custom_domains_domain ON shop_custom_domains(domain);
CREATE INDEX IF NOT EXISTS idx_shop_custom_domains_status ON shop_custom_domains(status);

-- Events
CREATE TABLE IF NOT EXISTS shop_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  event_type       TEXT,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ,
  is_recurring     BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_events_shop ON shop_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_events_starts_at ON shop_events(starts_at);

-- Site page views
CREATE TABLE IF NOT EXISTS shop_site_views (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  viewed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer         TEXT,
  is_custom_domain BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_shop_site_views_shop_time ON shop_site_views(shop_id, viewed_at);

-- Seed default sections for all existing shops
INSERT INTO shop_site_sections (shop_id, section_type, visible, sort_order, config)
SELECT s.id, v.section_type, v.visible, v.sort_order, v.config::jsonb
FROM shops s
CROSS JOIN (VALUES
  ('hero',           true,  0, '{}'),
  ('about',          true,  1, '{}'),
  ('hours_location', true,  2, '{}'),
  ('inventory',      true,  3, '{"inventory_display_limit": 24, "show_prices": true}'),
  ('buylist',        false, 4, '{}'),
  ('events',         false, 5, '{}'),
  ('gallery',        false, 6, '{}'),
  ('social',         true,  7, '{}'),
  ('contact',        true,  8, '{}')
) AS v(section_type, visible, sort_order, config)
ON CONFLICT (shop_id, section_type) DO NOTHING;
