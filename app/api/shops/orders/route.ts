import { NextRequest, NextResponse } from 'next/server';
import { findMany, findOne } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ orders: [], total: 0, pages: 0 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 25;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['"shopId" = ?'];
  const args: (string | number)[] = [shopId];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    args.push(status);
  }

  const where = conditions.join(' AND ');

  const [countRow, orders] = await Promise.all([
    findOne<{ count: string }>(`SELECT COUNT(*) as count FROM shop_orders WHERE ${where}`, args),
    findMany<{
      id: string;
      buyerUserId: string;
      status: string;
      subtotalCents: number;
      totalCents: number;
      fulfillmentType: string | null;
      notes: string | null;
      stripePaymentIntentId: string | null;
      createdAt: string;
      itemCount: number;
      buyerUsername: string;
      buyerEmail: string;
    }>(
      `SELECT o.id, o."buyerUserId", o.status, o."subtotalCents", o."totalCents",
              o."fulfillmentType", o.notes, o."stripePaymentIntentId", o."createdAt",
              COUNT(i.id) as "itemCount",
              u.username as "buyerUsername", u.email as "buyerEmail"
       FROM shop_orders o
       LEFT JOIN shop_order_items i ON i."orderId" = o.id
       LEFT JOIN users u ON u.id = o."buyerUserId"
       WHERE ${where}
       GROUP BY o.id, u.username, u.email
       ORDER BY o."createdAt" DESC
       LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    ),
  ]);

  const total = parseInt(countRow?.count ?? '0', 10);
  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
}
