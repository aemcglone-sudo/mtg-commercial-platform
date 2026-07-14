-- Guest holds: allow unauthenticated customers to place holds
-- collector_user_id becomes nullable; guest identity stored separately

ALTER TABLE holds ALTER COLUMN collector_user_id DROP NOT NULL;
ALTER TABLE hold_groups ALTER COLUMN collector_user_id DROP NOT NULL;

ALTER TABLE holds
  ADD COLUMN IF NOT EXISTS guest_name  TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_token TEXT UNIQUE;

ALTER TABLE hold_groups
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_holds_guest_email
  ON holds(guest_email) WHERE guest_email IS NOT NULL;
