CREATE TABLE IF NOT EXISTS format_ban_overrides (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  scryfall_id TEXT,
  card_name TEXT NOT NULL,
  ban_type TEXT NOT NULL,
  points_value INTEGER,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(format, card_name)
);

CREATE INDEX IF NOT EXISTS idx_format_ban_overrides_format ON format_ban_overrides(format);

-- Seed Vintage restricted list
INSERT INTO format_ban_overrides (id, format, card_name, ban_type, notes) VALUES
  (gen_random_uuid()::text, 'vintage', 'Ancestral Recall', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Black Lotus', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Mox Pearl', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Mox Sapphire', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Mox Jet', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Mox Ruby', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Mox Emerald', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Time Walk', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Timetwister', 'restricted', 'Power Nine'),
  (gen_random_uuid()::text, 'vintage', 'Time Vault', 'restricted', 'Infinite turns combo'),
  (gen_random_uuid()::text, 'vintage', 'Library of Alexandria', 'restricted', 'Broken card advantage'),
  (gen_random_uuid()::text, 'vintage', 'Demonic Tutor', 'restricted', 'Tutor'),
  (gen_random_uuid()::text, 'vintage', 'Vampiric Tutor', 'restricted', 'Tutor'),
  (gen_random_uuid()::text, 'vintage', 'Imperial Seal', 'restricted', 'Tutor'),
  (gen_random_uuid()::text, 'vintage', 'Sol Ring', 'restricted', 'Fast mana'),
  (gen_random_uuid()::text, 'vintage', 'Mana Crypt', 'restricted', 'Fast mana'),
  (gen_random_uuid()::text, 'vintage', 'Mana Vault', 'restricted', 'Fast mana'),
  (gen_random_uuid()::text, 'vintage', 'Tinker', 'restricted', 'Broken artifact tutor'),
  (gen_random_uuid()::text, 'vintage', 'Yawgmoth''s Will', 'restricted', 'Broken reuse'),
  (gen_random_uuid()::text, 'vintage', 'Necropotence', 'restricted', 'Card advantage'),
  (gen_random_uuid()::text, 'vintage', 'Gush', 'restricted', 'Free card draw'),
  (gen_random_uuid()::text, 'vintage', 'Gitaxian Probe', 'restricted', 'Free cantrip'),
  (gen_random_uuid()::text, 'vintage', 'Ponder', 'restricted', 'Cantrip'),
  (gen_random_uuid()::text, 'vintage', 'Preordain', 'restricted', 'Cantrip'),
  (gen_random_uuid()::text, 'vintage', 'Brainstorm', 'restricted', 'Cantrip'),
  (gen_random_uuid()::text, 'vintage', 'Flash', 'restricted', 'Combo enabler'),
  (gen_random_uuid()::text, 'vintage', 'Merchant Scroll', 'restricted', 'Tutor'),
  (gen_random_uuid()::text, 'vintage', 'Memory Jar', 'restricted', 'Combo'),
  (gen_random_uuid()::text, 'vintage', 'Wheel of Fortune', 'restricted', 'Wheel effect'),
  (gen_random_uuid()::text, 'vintage', 'Windfall', 'restricted', 'Wheel effect')
ON CONFLICT (format, card_name) DO NOTHING;

-- Seed Canadian Highlander point values (top-point cards)
INSERT INTO format_ban_overrides (id, format, card_name, ban_type, points_value, notes) VALUES
  (gen_random_uuid()::text, 'canadian_highlander', 'Black Lotus', 'points_value', 9, 'Max single card'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Ancestral Recall', 'points_value', 7, 'Broken draw'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Time Walk', 'points_value', 7, 'Extra turn'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Timetwister', 'points_value', 4, 'Wheel'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Mox Pearl', 'points_value', 4, 'Fast mana'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Mox Sapphire', 'points_value', 4, 'Fast mana'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Mox Jet', 'points_value', 4, 'Fast mana'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Mox Ruby', 'points_value', 4, 'Fast mana'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Mox Emerald', 'points_value', 4, 'Fast mana'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Sol Ring', 'points_value', 4, 'Fast mana'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Library of Alexandria', 'points_value', 4, 'Card advantage'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Demonic Tutor', 'points_value', 4, 'Tutor'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Brainstorm', 'points_value', 3, 'Cantrip'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Ponder', 'points_value', 2, 'Cantrip'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Gitaxian Probe', 'points_value', 2, 'Free cantrip'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Vampiric Tutor', 'points_value', 3, 'Tutor'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Tinker', 'points_value', 4, 'Artifact tutor'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Yawgmoth''s Will', 'points_value', 4, 'Broken reuse'),
  (gen_random_uuid()::text, 'canadian_highlander', 'Flash', 'points_value', 4, 'Combo')
ON CONFLICT (format, card_name) DO NOTHING;
