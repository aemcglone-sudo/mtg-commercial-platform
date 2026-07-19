import { NextRequest, NextResponse } from 'next/server';
import { getSession, setSessionCookie, Session } from '@/lib/session';
import { findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { role } = await req.json() as { role?: string };
  if (!role) return NextResponse.json({ error: 'role is required' }, { status: 400 });

  const user = await findOne<{ allowed_roles: string[] }>(
    `SELECT allowed_roles FROM users WHERE id = ?`,
    [session.userId]
  );

  if (!user?.allowed_roles?.includes(role)) {
    return NextResponse.json({ error: 'Role not authorized' }, { status: 403 });
  }

  const newSession: Session = { ...session, role: role as Session['role'] };
  const res = NextResponse.json({ ok: true, role });
  setSessionCookie(res, newSession);
  return res;
}
