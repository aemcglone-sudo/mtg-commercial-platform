import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { run } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  await run('UPDATE users SET "hasSeenTour" = true WHERE id = ?', [session.userId]);
  return NextResponse.json({ success: true });
}
