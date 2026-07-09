-- Discovered stores (non-Grimoire-partner shops found via OSM/Foursquare)
CREATE TABLE discovered_stores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,

  -- Source tracking
  osm_id              TEXT,
  foursquare_id       TEXT,
  grimoire_shop_id    TEXT REFERENCES shops(id) ON DELETE SET NULL,

  -- Location
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,
  lat                 DECIMAL(9,6) NOT NULL,
  lng                 DECIMAL(9,6) NOT NULL,

  -- Contact & web
  phone               TEXT,
  website_url         TEXT,

  -- Hours
  hours_raw           TEXT,
  hours               JSONB,

  -- Status
  is_active           BOOLEAN DEFAULT true,
  last_verified_at    TIMESTAMPTZ,

  -- Sync metadata
  last_synced_at      TIMESTAMPTZ DEFAULT NOW(),
  sync_source         TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON discovered_stores(lat, lng);
CREATE INDEX ON discovered_stores(grimoire_shop_id);
CREATE INDEX ON discovered_stores(osm_id);
CREATE INDEX ON discovered_stores(foursquare_id);
CREATE INDEX ON discovered_stores(is_active);

-- Events (unified table for all event sources)
CREATE TABLE local_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source — exactly one of these will be set
  grimoire_shop_id      TEXT REFERENCES shops(id) ON DELETE CASCADE,
  discovered_store_id   UUID REFERENCES discovered_stores(id) ON DELETE CASCADE,

  -- Event details
  title                 TEXT NOT NULL,
  event_type            TEXT NOT NULL,
  format                TEXT,

  -- Timing
  is_recurring          BOOLEAN DEFAULT false,
  day_of_week           TEXT,
  time_of_day           TEXT,
  specific_date         DATE,
  ends_at               TIMESTAMPTZ,

  -- Details
  entry_fee             TEXT,
  notes                 TEXT,
  external_url          TEXT,

  -- Source metadata
  source                TEXT NOT NULL,
  source_url            TEXT,
  wizards_event_id      TEXT UNIQUE,
  scrape_confidence     DECIMAL(3,2),

  -- Lifecycle
  is_active             BOOLEAN DEFAULT true,
  last_confirmed_at     TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON local_events(grimoire_shop_id);
CREATE INDEX ON local_events(discovered_store_id);
CREATE INDEX ON local_events(event_type);
CREATE INDEX ON local_events(specific_date);
CREATE INDEX ON local_events(is_recurring);
CREATE INDEX ON local_events(source);
CREATE INDEX ON local_events(is_active);

-- Collector location preferences (one row per collector)
CREATE TABLE collector_location_prefs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  default_lat           DECIMAL(9,6),
  default_lng           DECIMAL(9,6),
  default_zip           TEXT,
  default_city          TEXT,
  default_radius_miles  INTEGER DEFAULT 50,
  location_method       TEXT DEFAULT 'zip',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON collector_location_prefs(user_id);

-- Store claim requests
CREATE TABLE store_claim_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_store_id   UUID REFERENCES discovered_stores(id) ON DELETE CASCADE,
  requesting_user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  status                TEXT DEFAULT 'pending',
  verification_note     TEXT,
  admin_note            TEXT,
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           TEXT REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON store_claim_requests(discovered_store_id);
CREATE INDEX ON store_claim_requests(status);
CREATE INDEX ON store_claim_requests(requesting_user_id);
