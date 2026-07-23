import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { findOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ hasSeenTour: true });

  const user = await findOne<{ hasSeenTour: boolean }>(
    'SELECT "hasSeenTour" FROM users WHERE id = ?',
    [session.userId]
  );
  return NextResponse.json({ hasSeenTour: user?.hasSeenTour ?? true });
}
