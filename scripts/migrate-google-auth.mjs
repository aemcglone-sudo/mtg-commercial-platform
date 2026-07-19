import pg from 'pg';

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log('Running Google auth migration...');

await client.query(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] NOT NULL DEFAULT '{}';
`);
console.log('✓ added allowed_roles column');

await client.query(`
  UPDATE users SET allowed_roles = ARRAY[role]
  WHERE array_length(allowed_roles, 1) IS NULL OR array_length(allowed_roles, 1) = 0;
`);
console.log('✓ seeded allowed_roles from role');

await client.query(`
  UPDATE users SET allowed_roles = ARRAY['collector','shop_owner','admin']
  WHERE role = 'admin';
`);
console.log('✓ granted all roles to admin');

await client.query(`
  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users("googleId") WHERE "googleId" IS NOT NULL;

`);
console.log('✓ created google_id index');

await client.end();
console.log('Migration complete.');
