import { NextRequest, NextResponse } from 'next/server';
import { findOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const role = req.cookies.get('auth_token')?.value;
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const shop = await findOne<{
      id: string;
      name: string;
      slug: string;
      city: string | null;
      state: string | null;
      isActive: boolean;
    }>('SELECT id, name, slug, city, state, "isActive" FROM shops LIMIT 1');

    if (!shop) {
      return NextResponse.json({ shop: null, stats: null });
    }

    const inventoryRow = await findOne<{ count: string; total: string }>(
      'SELECT COUNT(*) as count, COALESCE(SUM("priceCents" * quantity), 0) as total FROM shop_inventory WHERE "shopId" = ?',
      [shop.id]
    );

    const orderRow = await findOne<{ pending: string; revenue: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COALESCE(SUM("totalCents") FILTER (WHERE status = 'paid' AND "createdAt" >= date_trunc('month', NOW())), 0) as revenue
       FROM shop_orders WHERE "shopId" = ?`,
      [shop.id]
    );

    return NextResponse.json({
      shop,
      stats: {
        inventoryCount: parseInt(inventoryRow?.count ?? '0', 10),
        totalValueCents: parseInt(inventoryRow?.total ?? '0', 10),
        pendingOrders: parseInt(orderRow?.pending ?? '0', 10),
        revenueThisMonthCents: parseInt(orderRow?.revenue ?? '0', 10),
      },
    });
  } catch {
    return NextResponse.json({ shop: null, stats: null });
  }
}
