import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { run } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { shopId } = await params;

  await run(
    `INSERT INTO collector_notification_prefs (id, user_id, opted_out_shops)
     VALUES (?, ?, ARRAY[?]::text[])
     ON CONFLICT (user_id) DO UPDATE
     SET opted_out_shops = array_append(
       CASE WHEN ? = ANY(collector_notification_prefs.opted_out_shops)
         THEN collector_notification_prefs.opted_out_shops
         ELSE collector_notification_prefs.opted_out_shops
       END, ?
     ),
     updated_at = NOW()`,
    [randomUUID(), userId, shopId, shopId, shopId]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { shopId } = await params;

  await run(
    `UPDATE collector_notification_prefs
     SET opted_out_shops = array_remove(opted_out_shops, ?), updated_at = NOW()
     WHERE user_id = ?`,
    [shopId, userId]
  );

  return NextResponse.json({ ok: true });
}
