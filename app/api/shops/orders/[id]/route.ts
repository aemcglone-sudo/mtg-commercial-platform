import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { id } = await params;

  const [order, items] = await Promise.all([
    findOne<{
      id: string; shopId: string; buyerUserId: string; status: string;
      subtotalCents: number; platformFeeCents: number; totalCents: number;
      fulfillmentType: string | null; notes: string | null;
      stripePaymentIntentId: string | null; createdAt: string;
      buyerUsername: string; buyerEmail: string;
    }>(
      `SELECT o.*, u.username as "buyerUsername", u.email as "buyerEmail"
       FROM shop_orders o
       LEFT JOIN users u ON u.id = o."buyerUserId"
       WHERE o.id = ? AND o."shopId" = ?`,
      [id, shopId]
    ),
    findMany<{
      id: string; cardName: string; quantity: number; priceCents: number; inventoryId: string | null;
    }>('SELECT id, "cardName", quantity, "priceCents", "inventoryId" FROM shop_order_items WHERE "orderId" = ?', [id]),
  ]);

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ order, items });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { id } = await params;
  const { status } = await req.json() as { status?: string };

  const VALID_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled'];
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await findOne<{ id: string }>(
    'SELECT id FROM shop_orders WHERE id = ? AND "shopId" = ?',
    [id, shopId]
  );
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await run(
    'UPDATE shop_orders SET status = ?, "updatedAt" = ? WHERE id = ?',
    [status, new Date().toISOString(), id]
  );

  return NextResponse.json({ ok: true });
}
