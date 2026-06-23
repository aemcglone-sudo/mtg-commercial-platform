import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findOne } from '@/lib/db';
import { setSessionCookie, Session } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await findOne<{
      id: string;
      email: string;
      passwordHash: string;
      role: string;
      name: string | null;
    }>(
      'SELECT id, email, "passwordHash", role, name FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const session: Session = {
      userId: user.id,
      role: user.role as Session['role'],
      email: user.email,
    };

    const res = NextResponse.json({ success: true, role: user.role });
    setSessionCookie(res, session);
    return res;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
