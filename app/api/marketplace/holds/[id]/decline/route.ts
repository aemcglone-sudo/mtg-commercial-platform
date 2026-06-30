import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { notifyCollector } from '@/lib/marketplace/notify';
import { holdDeclinedSms } from '@/lib/marketplace/sms';

export const dynamic = 'force-dynamic';

interface HoldRow { id: string; status: string; collector_user_id: string; card_name: string; shop_id: string; shop_name: string }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { shopNote?: string };

  const hold = await findOne<HoldRow>(
    `SELECT h.id, h.status, h.collector_user_id, h.card_name, h.shop_id, s.name AS shop_name
     FROM holds h JOIN shops s ON s.id = h.shop_id WHERE h.id = ? AND "userId" = ?`,
    [id, userId]
  );

  if (!hold) return NextResponse.json({ error: 'Hold not found' }, { status: 404 });
  if (hold.status !== 'requested') return NextResponse.json({ error: 'Hold is not in requested state' }, { status: 422 });

  await run(
    `UPDATE holds SET status = 'declined', shop_note = ?, declined_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [body.shopNote ?? null, id]
  );

  await notifyCollector(
    hold.collector_user_id,
    'hold_declined',
    {
      title: 'Hold unavailable',
      body: `${hold.shop_name}: ${body.shopNote ?? 'Card no longer available'}`,
      holdId: id,
      shopId: hold.shop_id,
      ctaUrl: `/marketplace/find`,
    },
    holdDeclinedSms(hold.card_name, hold.shop_name, body.shopNote)
  );

  return NextResponse.json({ ok: true });
}
