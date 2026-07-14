import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { storeId } = await params;

  const store = await findOne(`SELECT id FROM discovered_stores WHERE id = ?`, [storeId]);
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  // Check for existing pending claim
  const existing = await findOne(
    `SELECT id FROM store_claim_requests WHERE discovered_store_id = ? AND requesting_user_id = ? AND status = 'pending'`,
    [storeId, userId]
  );
  if (existing) return NextResponse.json({ error: 'Claim already pending' }, { status: 409 });

  const { verification_note } = await req.json() as { verification_note?: string };

  await run(
    `INSERT INTO store_claim_requests (id, discovered_store_id, requesting_user_id, verification_note)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), storeId, userId, verification_note ?? null]
  );

  return NextResponse.json({ ok: true });
}
