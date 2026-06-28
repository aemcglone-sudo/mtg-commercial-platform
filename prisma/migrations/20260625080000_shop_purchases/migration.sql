CREATE TABLE IF NOT EXISTS shop_purchases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  seller_name TEXT,
  seller_contact TEXT,
  total_paid_cents INTEGER NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_purchase_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  purchase_id TEXT NOT NULL REFERENCES shop_purchases(id) ON DELETE CASCADE,
  scryfall_id TEXT NOT NULL,
  card_name TEXT NOT NULL,
  set_code TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL,
  foil BOOLEAN DEFAULT false,
  quantity INTEGER NOT NULL,
  buy_price_cents INTEGER NOT NULL,
  tcg_market_cents INTEGER NOT NULL,
  target_sell_price_cents INTEGER
);

CREATE INDEX IF NOT EXISTS shop_purchases_shop_id ON shop_purchases(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_purchase_items_purchase_id ON shop_purchase_items(purchase_id);
