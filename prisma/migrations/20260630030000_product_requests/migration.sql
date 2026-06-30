CREATE TABLE product_requests (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  collector_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES mtg_products(id),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  shop_response TEXT,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON product_requests(collector_user_id);
CREATE INDEX ON product_requests(shop_id);
CREATE INDEX ON product_requests(status);
