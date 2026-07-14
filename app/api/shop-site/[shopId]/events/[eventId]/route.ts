import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function resolveShop(req: NextRequest, shopId: string) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return null;
  return await findOne<{ id: string }>(`SELECT id FROM shops WHERE id = ? AND "userId" = ?`, [shopId, userId]);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ shopId: string; eventId: string }> }) {
  const { shopId, eventId } = await params;
  const shop = await resolveShop(req, shopId);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    title?: string; description?: string | null; eventType?: string | null;
    startsAt?: string; endsAt?: string | null; isRecurring?: boolean; recurrenceRule?: string | null;
  };

  await run(
    `UPDATE shop_events SET title = ?, description = ?, event_type = ?, starts_at = ?::timestamptz, ends_at = ?::timestamptz,
     is_recurring = ?, recurrence_rule = ?
     WHERE id = ? AND shop_id = ?`,
    [body.title ?? null, body.description ?? null, body.eventType ?? null, body.startsAt ?? null, body.endsAt ?? null,
     body.isRecurring ?? false, body.recurrenceRule ?? null, eventId, shopId]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ shopId: string; eventId: string }> }) {
  const { shopId, eventId } = await params;
  const shop = await resolveShop(req, shopId);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await run(`DELETE FROM shop_events WHERE id = ? AND shop_id = ?`, [eventId, shopId]);
  return NextResponse.json({ ok: true });
}
