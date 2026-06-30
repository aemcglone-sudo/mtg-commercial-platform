CREATE TABLE mtg_products (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  product_type TEXT NOT NULL,
  set_code TEXT,
  set_name TEXT,
  release_date DATE,
  msrp_cents INTEGER,
  image_url TEXT,
  description TEXT,
  tcgplayer_product_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON mtg_products(category);
CREATE INDEX ON mtg_products(set_code);
CREATE INDEX ON mtg_products(product_type);
CREATE INDEX ON mtg_products(name);
