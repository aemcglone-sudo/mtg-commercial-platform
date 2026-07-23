import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findOne, run } from '@/lib/db';
import { getSession, setSessionCookie, Session } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json() as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'New password must be different from current password' }, { status: 400 });
  }

  const user = await findOne<{ id: string; passwordHash: string }>(
    'SELECT id, "passwordHash" FROM users WHERE id = ?',
    [session.userId]
  );
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await run(
    'UPDATE users SET "passwordHash" = ?, "mustChangePassword" = false, "updatedAt" = NOW() WHERE id = ?',
    [newHash, session.userId]
  );

  const updatedSession: Session = { ...session, mustChangePassword: false };
  const res = NextResponse.json({ success: true });
  setSessionCookie(res, updatedSession);
  return res;
}
