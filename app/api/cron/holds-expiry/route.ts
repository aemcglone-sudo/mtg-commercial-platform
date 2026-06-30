import { NextRequest, NextResponse } from 'next/server';
import { findMany, run } from '@/lib/db';
import { createNotification } from '@/lib/marketplace/notify';

export const dynamic = 'force-dynamic';

function checkCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

interface HoldRow {
  id: string;
  collector_user_id: string;
  shop_id: string;
  card_name: string;
  condition: string;
  shop_owner_user_id: string;
  shop_name: string;
}

export async function GET(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Expire unresponded requests (24h no shop response)
  const expiredRequests = await findMany<HoldRow>(`
    SELECT h.id, h.collector_user_id, h.shop_id, h.card_name, h.condition,
           s."userId" AS shop_owner_user_id, s.name AS shop_name
    FROM holds h
    JOIN shops s ON s.id = h.shop_id
    WHERE h.status = 'requested' AND h.request_expires_at < NOW()
  `, []);

  for (const hold of expiredRequests) {
    await run(`UPDATE holds SET status = 'expired', updated_at = NOW() WHERE id = ?`, [hold.id]);
    await createNotification(hold.collector_user_id, 'hold_expired', {
      title: 'Hold expired',
      body: `${hold.shop_name} didn't respond in time. Try another store.`,
      holdId: hold.id,
      shopId: hold.shop_id,
      ctaUrl: `/marketplace/find`,
    });
  }

  // Expire confirmed holds past pickup window (72h no pickup)
  const expiredPickups = await findMany<HoldRow>(`
    SELECT h.id, h.collector_user_id, h.shop_id, h.card_name, h.condition,
           s."userId" AS shop_owner_user_id, s.name AS shop_name
    FROM holds h
    JOIN shops s ON s.id = h.shop_id
    WHERE h.status = 'confirmed' AND h.pickup_expires_at < NOW()
  `, []);

  for (const hold of expiredPickups) {
    await run(`UPDATE holds SET status = 'expired', updated_at = NOW() WHERE id = ?`, [hold.id]);
    await createNotification(hold.collector_user_id, 'hold_expired', {
      title: 'Hold expired',
      body: `Your pickup window for ${hold.card_name} has passed. The card has been released.`,
      holdId: hold.id,
      shopId: hold.shop_id,
    });
    await createNotification(hold.shop_owner_user_id, 'hold_expired_owner', {
      title: 'Hold expired — no pickup',
      body: `${hold.card_name} hold expired. Card is back in available stock.`,
      holdId: hold.id,
    });
  }

  void now;
  return NextResponse.json({
    expired_requests: expiredRequests.length,
    expired_pickups: expiredPickups.length,
  });
}
