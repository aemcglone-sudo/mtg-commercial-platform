CREATE TABLE shop_products (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text PRIMARY KEY,
  "shopId" TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES mtg_products(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  "priceCents" INTEGER NOT NULL,
  fulfillment_type TEXT NOT NULL DEFAULT 'pickup',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("shopId", "productId")
);
CREATE INDEX ON shop_products("shopId");
CREATE INDEX ON shop_products("productId");
