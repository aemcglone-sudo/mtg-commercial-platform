import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { findOne, run } from '@/lib/db';
import { setSessionCookie, Session } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json() as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
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

    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    await run(
      `INSERT INTO users (id, email, "passwordHash", name, role, "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, 'collector', ?, ?)`,
      [id, email.toLowerCase().trim(), passwordHash, name.trim(), now, now]
    );

    const session: Session = { userId: id, role: 'collector', email: email.toLowerCase().trim() };
    const res = NextResponse.json({ success: true }, { status: 201 });
    setSessionCookie(res, session);
    return res;
  } catch (err) {
    console.error('Collector registration error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
