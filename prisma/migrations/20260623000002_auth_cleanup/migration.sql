-- Make username nullable (spec drops the username field)
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;

-- Rename role value 'enthusiast' → 'collector' to match spec
UPDATE "users" SET role = 'collector' WHERE role = 'enthusiast';

-- Update default for new users
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'collector';

-- Add name column for display name
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;
