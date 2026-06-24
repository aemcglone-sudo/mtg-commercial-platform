import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getSession, setSessionCookie, Session } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const user = await findOne<{ name: string | null; email: string }>(
    'SELECT name, email FROM users WHERE id = ?',
    [session.userId]
  );

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { name, email } = await req.json() as { name?: string; email?: string };

  if (!name?.trim() && !email?.trim()) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  if (email?.trim()) {
    const existing = await findOne<{ id: string }>(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email.toLowerCase().trim(), session.userId]
    );
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }
  }

  if (name?.trim()) {
    await run('UPDATE users SET name = ? WHERE id = ?', [name.trim(), session.userId]);
  }
  if (email?.trim()) {
    await run('UPDATE users SET email = ? WHERE id = ?', [email.toLowerCase().trim(), session.userId]);
  }

  const updated = await findOne<{ name: string | null; email: string }>(
    'SELECT name, email FROM users WHERE id = ?',
    [session.userId]
  );

  // Refresh session cookie with new email if changed
  const res = NextResponse.json({ success: true, user: updated });
  if (email?.trim() && email.toLowerCase().trim() !== session.email) {
    const newSession: Session = { ...session, email: email.toLowerCase().trim() };
    setSessionCookie(res, newSession);
  }

  return res;
}
