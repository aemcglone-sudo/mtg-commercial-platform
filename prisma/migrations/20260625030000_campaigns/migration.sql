CREATE TABLE IF NOT EXISTS tournament_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  "eventDate" DATE NOT NULL,
  "sourceUrl" TEXT,
  "fetchedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_decklists (
  id TEXT PRIMARY KEY,
  "eventId" TEXT REFERENCES tournament_events(id),
  archetype TEXT NOT NULL,
  placement INTEGER,
  decklist JSONB NOT NULL,
  "fetchedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_campaigns (
  id TEXT PRIMARY KEY,
  "shopId" TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT DEFAULT 'active',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_campaigns_shop_status ON shop_campaigns("shopId", status);
