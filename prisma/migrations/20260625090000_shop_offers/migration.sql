CREATE TABLE IF NOT EXISTS shop_offers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  total_cents INTEGER NOT NULL,
  rounded_total_cents INTEGER NOT NULL,
  shop_name TEXT NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
