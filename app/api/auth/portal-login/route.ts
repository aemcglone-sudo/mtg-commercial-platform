import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findOne } from '@/lib/db';
import { setSessionCookie, Session } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json() as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const user = await findOne<{
      id: string;
      email: string;
      passwordHash: string;
      role: string;
      mustChangePassword: boolean;
    }>(
      'SELECT id, email, "passwordHash", role, "mustChangePassword" FROM users WHERE username = ?',
      [username.trim()]
    );

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const session: Session = {
      userId: user.id,
      role: user.role as Session['role'],
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    };

    const res = NextResponse.json({ success: true, mustChangePassword: user.mustChangePassword });
    setSessionCookie(res, session);
    return res;
  } catch (err) {
    console.error('Portal login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
