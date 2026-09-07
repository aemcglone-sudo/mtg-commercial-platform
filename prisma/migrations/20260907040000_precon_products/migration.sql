CREATE TABLE IF NOT EXISTS "precon_products" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "set_code" TEXT NOT NULL,
  "commander" TEXT,
  "release_date" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE ("name", "set_code")
);

CREATE TABLE IF NOT EXISTS "precon_product_cards" (
  "id" TEXT PRIMARY KEY,
  "product_id" TEXT NOT NULL REFERENCES "precon_products"("id") ON DELETE CASCADE,
  "scryfall_id" TEXT NOT NULL,
  "card_name" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "foil_only" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("product_id", "scryfall_id")
);
CREATE INDEX IF NOT EXISTS "precon_product_cards_product_id_idx" ON "precon_product_cards" ("product_id");
