import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { findOne, run } from './db';

interface SeedUser {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'collector' | 'shop_owner';
}

async function seedUser(user: SeedUser): Promise<void> {
  const existing = await findOne('SELECT id FROM users WHERE email = ?', [user.email]);
  if (existing) return;
  const passwordHash = await bcrypt.hash(user.password, 10);
  const id = randomUUID();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO users (id, email, "passwordHash", name, role, "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, user.email, passwordHash, user.name, user.role, now, now]
  );
  if (user.role === 'shop_owner') {
    const shopId = randomUUID();
    await run(
      `INSERT INTO shops (id, "userId", name, slug, "isActive", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, true, ?, ?)
       ON CONFLICT DO NOTHING`,
      [shopId, id, 'Test Shop', `test-shop-${shopId.slice(0, 6)}`, now, now]
    );
  }
}

let seeded = false;

export async function seedIfNeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;

  const seeds: SeedUser[] = [];

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    seeds.push({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: 'Admin', role: 'admin' });
  }
  if (process.env.SEED_COLLECTOR_EMAIL && process.env.SEED_COLLECTOR_PASSWORD) {
    seeds.push({ email: process.env.SEED_COLLECTOR_EMAIL, password: process.env.SEED_COLLECTOR_PASSWORD, name: 'Test Collector', role: 'collector' });
  }
  if (process.env.SEED_SHOP_EMAIL && process.env.SEED_SHOP_PASSWORD) {
    seeds.push({ email: process.env.SEED_SHOP_EMAIL, password: process.env.SEED_SHOP_PASSWORD, name: 'Test Shop Owner', role: 'shop_owner' });
  }

  for (const user of seeds) {
    try {
      await seedUser(user);
    } catch (err) {
      console.error(`Seed failed for ${user.email}:`, err);
    }
  }
}
