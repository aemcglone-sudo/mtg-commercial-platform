import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await findOne<{ email: string }>(
    `SELECT email FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const result = await run(
    `UPDATE holds
     SET collector_user_id = ?, guest_token = NULL, updated_at = NOW()
     WHERE guest_email = LOWER(?) AND collector_user_id IS NULL`,
    [userId, user.email]
  );

  return NextResponse.json({ claimed: result.rowCount ?? 0 });
}
