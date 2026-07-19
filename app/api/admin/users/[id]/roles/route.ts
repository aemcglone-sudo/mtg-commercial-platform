import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { grant, revoke } = await req.json() as { grant?: string; revoke?: string };
  const VALID = new Set(['collector', 'shop_owner', 'admin']);

  if (grant && !VALID.has(grant)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  if (revoke && !VALID.has(revoke)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  const user = await findOne<{ id: string; allowed_roles: string[] }>(
    `SELECT id, allowed_roles FROM users WHERE id = ?`, [id]
  );
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (grant) {
    await run(
      `UPDATE users SET allowed_roles = array_append(allowed_roles, ?), "updatedAt" = NOW()
       WHERE id = ? AND NOT (allowed_roles @> ARRAY[?::text])`,
      [grant, id, grant]
    );
  }
  if (revoke) {
    await run(
      `UPDATE users SET allowed_roles = array_remove(allowed_roles, ?), "updatedAt" = NOW()
       WHERE id = ?`,
      [revoke, id]
    );
  }

  const updated = await findOne<{ allowed_roles: string[] }>(
    `SELECT allowed_roles FROM users WHERE id = ?`, [id]
  );
  return NextResponse.json({ ok: true, allowedRoles: updated?.allowed_roles ?? [] });
}
