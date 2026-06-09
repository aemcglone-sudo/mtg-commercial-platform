import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { findOne, run } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password)
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    if (username.length < 3 || username.length > 30)
      return NextResponse.json({ error: 'Username must be 3–30 characters' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

    const existing = await findOne(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [username.toLowerCase(), email.toLowerCase()]
    );
    if (existing)
      return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = randomUUID();

    await run(
      `INSERT INTO users (id, username, email, "passwordHash", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, username.toLowerCase(), email.toLowerCase(), passwordHash]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: `Registration failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
