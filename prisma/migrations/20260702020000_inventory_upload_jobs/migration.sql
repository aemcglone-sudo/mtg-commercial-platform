CREATE TABLE inventory_upload_jobs (
  id          TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | done | error
  merge_mode  TEXT NOT NULL DEFAULT 'add',
  total       INTEGER,
  added       INTEGER,
  skipped     INTEGER,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
