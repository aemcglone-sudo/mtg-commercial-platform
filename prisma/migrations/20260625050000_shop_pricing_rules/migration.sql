CREATE TABLE IF NOT EXISTS shop_pricing_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL,
  scope_conditions TEXT[] DEFAULT '{}',
  scope_rarities TEXT[] DEFAULT '{}',
  scope_set_codes TEXT[] DEFAULT '{}',
  scope_price_min_cents INTEGER,
  scope_price_max_cents INTEGER,
  strategy TEXT NOT NULL,
  strategy_value DECIMAL(8,2),
  strategy_direction TEXT,
  floor_price_cents INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shop_pricing_rules_shop_priority ON shop_pricing_rules(shop_id, priority);
