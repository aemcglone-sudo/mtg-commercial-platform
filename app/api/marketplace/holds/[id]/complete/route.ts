import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { notifyCollector } from '@/lib/marketplace/notify';

export const dynamic = 'force-dynamic';

interface HoldRow {
  id: string; status: string; collector_user_id: string; card_name: string;
  shop_id: string; shop_name: string; inventory_item_id: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const hold = await findOne<HoldRow>(
    `SELECT h.id, h.status, h.collector_user_id, h.card_name, h.shop_id,
            s.name AS shop_name, h.inventory_item_id
     FROM holds h JOIN shops s ON s.id = h.shop_id WHERE h.id = ? AND "userId" = ?`,
    [id, userId]
  );

  if (!hold) return NextResponse.json({ error: 'Hold not found' }, { status: 404 });
  if (hold.status !== 'confirmed') return NextResponse.json({ error: 'Hold must be confirmed before completing' }, { status: 422 });

  await run(
    `UPDATE holds SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [id]
  );

  // Decrement inventory — only on completion, never earlier
  if (hold.inventory_item_id) {
    await run(
      `UPDATE shop_inventory SET quantity = GREATEST(0, quantity - 1), updated_at = NOW() WHERE id = ?`,
      [hold.inventory_item_id]
    );
  }

  await notifyCollector(hold.collector_user_id, 'hold_completed', {
    title: 'Pickup confirmed!',
    body: `Enjoy your ${hold.card_name} from ${hold.shop_name}!`,
    holdId: id,
    shopId: hold.shop_id,
  });

  return NextResponse.json({ ok: true });
}
