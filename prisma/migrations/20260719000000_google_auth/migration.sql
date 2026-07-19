-- Google OAuth migration: add allowed_roles, make passwordHash optional
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] NOT NULL DEFAULT '{}';

-- Seed allowed_roles from existing role column so current users don't lose access
UPDATE users SET allowed_roles = ARRAY[role] WHERE array_length(allowed_roles, 1) IS NULL OR array_length(allowed_roles, 1) = 0;

-- Admin gets all roles
UPDATE users SET allowed_roles = ARRAY['collector','shop_owner','admin'] WHERE role = 'admin';

-- passwordHash is already nullable in schema — no DDL needed
-- googleId already exists — no DDL needed
-- avatarUrl already exists — no DDL needed

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users("googleId") WHERE "googleId" IS NOT NULL;
