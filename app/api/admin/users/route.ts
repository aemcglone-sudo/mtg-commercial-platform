import { NextRequest, NextResponse } from 'next/server';
import { findMany, run } from '@/lib/db';
import { getSession } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await findMany<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    allowed_roles: string[];
    createdAt: string;
  }>('SELECT id, name, email, role, allowed_roles, "createdAt" FROM users ORDER BY "createdAt" DESC', []);

  const users = rows.map(u => ({ ...u, allowedRoles: u.allowed_roles ?? [] }));
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password, role } = await req.json() as { name?: string; email?: string; password?: string; role?: string };

  if (!email?.trim()) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  if (role !== 'collector' && role !== 'shop_owner') return NextResponse.json({ error: 'Role must be collector or shop_owner.' }, { status: 400 });

  const existing = await findMany<{ id: string }>('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing.length > 0) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });

  const hashed = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const now = new Date().toISOString();

  await run(
    'INSERT INTO users (id, name, email, password, role, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name?.trim() || null, email.trim().toLowerCase(), hashed, role, now, now]
  );

  if (role === 'shop_owner') {
    await run(
      'INSERT INTO shops (id, "userId", name, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), id, 'My Shop', now, now]
    );
  }

  return NextResponse.json({ id, name: name?.trim() || null, email: email.trim().toLowerCase(), role }, { status: 201 });
}
