import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { notifyShopOwner } from '@/lib/marketplace/notify';
import { holdCancelledSms } from '@/lib/marketplace/sms';

export const dynamic = 'force-dynamic';

interface HoldRow {
  id: string; status: string; collector_user_id: string; card_name: string;
  condition: string; shop_id: string; shop_name: string; shop_owner_user_id: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const hold = await findOne<HoldRow>(
    `SELECT h.id, h.status, h.collector_user_id, h.card_name, h.condition,
            h.shop_id, s.name AS shop_name, s.user_id AS shop_owner_user_id
     FROM holds h JOIN shops s ON s.id = h.shop_id
     WHERE h.id = ? AND h.collector_user_id = ?`,
    [id, userId]
  );

  if (!hold) return NextResponse.json({ error: 'Hold not found' }, { status: 404 });
  if (!['requested', 'confirmed'].includes(hold.status)) {
    return NextResponse.json({ error: 'Hold cannot be cancelled in its current state' }, { status: 422 });
  }

  await run(
    `UPDATE holds SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [id]
  );

  await notifyShopOwner(hold.shop_id, hold.shop_owner_user_id, 'hold_cancelled', {
    title: 'Hold cancelled',
    body: `Collector cancelled their hold on ${hold.card_name}`,
    holdId: id,
  }, holdCancelledSms(hold.card_name, hold.condition));

  return NextResponse.json({ ok: true });
}
