CREATE TABLE IF NOT EXISTS collector_favorite_shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "shopId" TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "shopId")
);
CREATE INDEX IF NOT EXISTS idx_favorite_shops_user ON collector_favorite_shops("userId");
