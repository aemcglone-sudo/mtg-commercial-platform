import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { findOne, run } from '@/lib/db';
import { setSessionCookie, Session } from '@/lib/session';

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, storeName } = await req.json() as {
      name?: string;
      email?: string;
      password?: string;
      storeName?: string;
    };

    if (!name?.trim() || !email?.trim() || !password || !storeName?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const existing = await findOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    await run(
      `INSERT INTO users (id, email, "passwordHash", name, role, "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, 'shop_owner', ?, ?)`,
      [userId, email.toLowerCase().trim(), passwordHash, name.trim(), now, now]
    );

    // Create stub shop record
    const shopId = randomUUID();
    const baseSlug = toSlug(storeName.trim()) || 'my-shop';
    // Ensure slug uniqueness by appending random suffix if taken
    const existingSlug = await findOne('SELECT id FROM shops WHERE slug = ?', [baseSlug]);
    const slug = existingSlug ? `${baseSlug}-${shopId.slice(0, 6)}` : baseSlug;

    await run(
      `INSERT INTO shops (id, "userId", name, slug, "isActive", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, true, ?, ?)`,
      [shopId, userId, storeName.trim(), slug, now, now]
    );

    const session: Session = { userId, role: 'shop_owner', email: email.toLowerCase().trim() };
    const res = NextResponse.json({ success: true }, { status: 201 });
    setSessionCookie(res, session);
    return res;
  } catch (err) {
    console.error('Shop registration error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
