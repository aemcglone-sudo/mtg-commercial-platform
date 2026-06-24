import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await query<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
  }>('SELECT id, name, email, role, "createdAt" FROM users ORDER BY "createdAt" DESC', []);

  return NextResponse.json({ users });
}
