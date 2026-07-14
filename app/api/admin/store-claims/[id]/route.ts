import { NextRequest, NextResponse } from 'next/server';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { run } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const adminId = getAuthenticatedUserId(req)!;

  const body = await req.json() as { status: 'approved' | 'rejected'; admin_note?: string };
  if (!['approved', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await run(
    `UPDATE store_claim_requests SET
       status=?, admin_note=?, reviewed_at=NOW(), reviewed_by=?
     WHERE id=?`,
    [body.status, body.admin_note ?? null, adminId, id]
  );

  return NextResponse.json({ ok: true });
}
