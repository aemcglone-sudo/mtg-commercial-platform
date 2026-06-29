import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { notifyCollector } from '@/lib/marketplace/notify';
import { holdConfirmedSms } from '@/lib/marketplace/sms';

export const dynamic = 'force-dynamic';

interface HoldRow {
  id: string; status: string; collector_user_id: string; card_name: string;
  shop_id: string; shop_name: string; pickup_expiry_hours: string;
}

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
    `SELECT h.id, h.status, h.collector_user_id, h.card_name, h.shop_id,
            s.name AS shop_name,
            COALESCE(snp.pickup_expiry_hours, 72)::text AS pickup_expiry_hours
     FROM holds h
     JOIN shops s ON s.id = h.shop_id
     LEFT JOIN shop_notification_prefs snp ON snp.shop_id = h.shop_id
     WHERE h.id = ? AND s.user_id = ?`,
    [id, userId]
  );

  if (!hold) return NextResponse.json({ error: 'Hold not found' }, { status: 404 });
  if (hold.status !== 'requested') return NextResponse.json({ error: 'Hold is not in requested state' }, { status: 422 });

  const pickupHours = parseInt(hold.pickup_expiry_hours);
  const pickupExpiresAt = new Date(Date.now() + pickupHours * 3600 * 1000).toISOString();

  await run(
    `UPDATE holds SET status = 'confirmed', shop_note = ?, confirmed_at = NOW(),
     pickup_expires_at = ?, updated_at = NOW() WHERE id = ?`,
    [body.shopNote ?? null, pickupExpiresAt, id]
  );

  await notifyCollector(
    hold.collector_user_id,
    'hold_confirmed',
    {
      title: 'Hold confirmed!',
      body: `${hold.shop_name} has your ${hold.card_name} ready for pickup`,
      holdId: id,
      shopId: hold.shop_id,
      ctaUrl: `/marketplace/holds/${id}`,
    },
    holdConfirmedSms(hold.card_name, hold.shop_name)
  );

  return NextResponse.json({ ok: true });
}
