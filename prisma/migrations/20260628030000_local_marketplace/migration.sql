-- Local Marketplace feature: holds, watchlist, notifications, campaigns

-- Extend shops table
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS marketplace_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hours              JSONB,
  ADD COLUMN IF NOT EXISTS specialties        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hold_instructions  TEXT,
  ADD COLUMN IF NOT EXISTS featured_until     TIMESTAMPTZ;

-- Hold groups (multi-card, same shop, same visit)
CREATE TABLE hold_groups (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  collector_user_id TEXT NOT NULL,
  shop_id           TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  source_deck_id    TEXT,
  source_list_id    TEXT,
  collector_note    TEXT,
  pickup_window     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON hold_groups(collector_user_id);
CREATE INDEX ON hold_groups(shop_id);

-- Holds
CREATE TABLE holds (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  collector_user_id     TEXT NOT NULL,
  shop_id               TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  inventory_item_id     TEXT,
  hold_group_id         TEXT REFERENCES hold_groups(id) ON DELETE SET NULL,

  -- Card snapshot
  card_name             TEXT NOT NULL,
  scryfall_id           TEXT NOT NULL,
  set_code              TEXT NOT NULL,
  collector_number      TEXT,
  condition             TEXT NOT NULL,
  foil                  BOOLEAN NOT NULL DEFAULT false,
  price_cents           INTEGER NOT NULL,

  -- Status: requested | confirmed | completed | declined | expired | cancelled
  status                TEXT NOT NULL DEFAULT 'requested',

  -- Collector input
  collector_note        TEXT,
  pickup_window         TEXT,

  -- Shop response
  shop_note             TEXT,
  confirmed_at          TIMESTAMPTZ,
  declined_at           TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,

  -- Expiry
  request_expires_at    TIMESTAMPTZ NOT NULL,
  pickup_expires_at     TIMESTAMPTZ,

  -- Notification tracking
  shop_notified_sms_at  TIMESTAMPTZ,
  shop_notified_app_at  TIMESTAMPTZ,
  collector_notified_at TIMESTAMPTZ,

  -- Attribution
  source_deck_id        TEXT,
  source_list_id        TEXT,
  source_campaign_id    TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON holds(collector_user_id);
CREATE INDEX ON holds(shop_id);
CREATE INDEX ON holds(status);
CREATE INDEX ON holds(inventory_item_id);
CREATE INDEX ON holds(hold_group_id);
CREATE INDEX ON holds(source_campaign_id);
CREATE INDEX ON holds(request_expires_at) WHERE status = 'requested';
CREATE INDEX ON holds(pickup_expires_at) WHERE status = 'confirmed';

-- Shop notification preferences
CREATE TABLE shop_notification_prefs (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_id              TEXT NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  sms_enabled          BOOLEAN NOT NULL DEFAULT true,
  sms_number           TEXT,
  email_enabled        BOOLEAN NOT NULL DEFAULT true,
  app_enabled          BOOLEAN NOT NULL DEFAULT true,
  request_expiry_hours INTEGER NOT NULL DEFAULT 24,
  pickup_expiry_hours  INTEGER NOT NULL DEFAULT 72,
  max_active_holds     INTEGER NOT NULL DEFAULT 50,
  campaigns_per_week   INTEGER NOT NULL DEFAULT 3,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Collector notification preferences (includes location + SMS opt-in)
CREATE TABLE collector_notification_prefs (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               TEXT NOT NULL UNIQUE,
  availability_alerts   BOOLEAN NOT NULL DEFAULT true,
  campaign_notifications BOOLEAN NOT NULL DEFAULT true,
  hold_notifications    BOOLEAN NOT NULL DEFAULT true,
  search_radius_miles   INTEGER NOT NULL DEFAULT 50,
  opted_out_shops       TEXT[] NOT NULL DEFAULT '{}',
  lat                   DECIMAL(9,6),
  lng                   DECIMAL(9,6),
  location_updated_at   TIMESTAMPTZ,
  sms_enabled           BOOLEAN NOT NULL DEFAULT false,
  sms_number            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON collector_notification_prefs(user_id);

-- Collector card watchlist (availability alert index)
CREATE TABLE collector_card_watchlist (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               TEXT NOT NULL,
  scryfall_id           TEXT NOT NULL,
  card_name             TEXT NOT NULL,
  source_type           TEXT NOT NULL,  -- deck_missing | wishlist | manual
  source_id             TEXT,
  max_price_cents       INTEGER,
  condition_floor       TEXT NOT NULL DEFAULT 'HP',
  last_notified_at      TIMESTAMPTZ,
  notify_cooldown_hours INTEGER NOT NULL DEFAULT 24,
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ON collector_card_watchlist(user_id, scryfall_id, source_type, COALESCE(source_id, ''));
CREATE INDEX ON collector_card_watchlist(scryfall_id) WHERE active = true;
CREATE INDEX ON collector_card_watchlist(user_id) WHERE active = true;
CREATE INDEX ON collector_card_watchlist(last_notified_at);

-- In-app notifications
CREATE TABLE notifications (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  hold_id     TEXT,
  campaign_id TEXT,
  scryfall_id TEXT,
  shop_id     TEXT,
  cta_url     TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON notifications(user_id);
CREATE INDEX ON notifications(user_id, created_at DESC);
CREATE INDEX ON notifications(hold_id);
CREATE INDEX ON notifications(read) WHERE read = false;

-- Shop campaigns
CREATE TABLE shop_campaigns (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_id          TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,  -- new_inventory | sale | buylist | featured_card | event
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  cta_text         TEXT,
  cta_url          TEXT,
  target_type      TEXT NOT NULL DEFAULT 'matching_watchlist',
  radius_miles     INTEGER NOT NULL DEFAULT 50,
  scryfall_ids     TEXT[] NOT NULL DEFAULT '{}',
  discount_percent INTEGER,
  valid_until      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'draft',  -- draft | scheduled | sent | cancelled
  scheduled_for    TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  recipients_count INTEGER,
  week_number      INTEGER,
  week_year        INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON shop_campaigns(shop_id);
CREATE INDEX ON shop_campaigns(status);
CREATE INDEX ON shop_campaigns(shop_id, week_number, week_year);

-- Campaign delivery receipts
CREATE TABLE campaign_deliveries (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id  TEXT NOT NULL REFERENCES shop_campaigns(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read         BOOLEAN NOT NULL DEFAULT false,
  read_at      TIMESTAMPTZ,
  clicked      BOOLEAN NOT NULL DEFAULT false,
  clicked_at   TIMESTAMPTZ,
  UNIQUE(campaign_id, user_id)
);
CREATE INDEX ON campaign_deliveries(campaign_id);
CREATE INDEX ON campaign_deliveries(user_id);
