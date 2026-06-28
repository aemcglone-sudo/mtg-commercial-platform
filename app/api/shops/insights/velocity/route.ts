import { NextRequest, NextResponse } from 'next/server';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

interface ShopRow { id: string }
interface TopSellerRow { card_name: string; units_sold: string; revenue_cents: string }
interface RecentlySoldRow { card_name: string; condition: string | null; price_cents: string; sold_at: string }
interface DeadStockRow { id: string; card_name: string; condition: string; quantity: string; price_cents: string; days_idle: string }
interface DeadStockTotalsRow { count: string; value_cents: string }

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shop = await findOne<ShopRow>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }
  const shopId = shop.id;

  const topByUnitsSql = `
    SELECT soi."cardName" as card_name, SUM(soi.quantity) as units_sold, SUM(soi."priceCents" * soi.quantity) as revenue_cents
    FROM shop_order_items soi
    JOIN shop_orders so ON so.id = soi."orderId"
    WHERE so."shopId" = ? AND so.status = 'fulfilled' AND so."createdAt" > NOW() - INTERVAL '30 days'
    GROUP BY soi."cardName" ORDER BY units_sold DESC LIMIT 10
  `;

  const topByRevenueSql = `
    SELECT soi."cardName" as card_name, SUM(soi.quantity) as units_sold, SUM(soi."priceCents" * soi.quantity) as revenue_cents
    FROM shop_order_items soi
    JOIN shop_orders so ON so.id = soi."orderId"
    WHERE so."shopId" = ? AND so.status = 'fulfilled' AND so."createdAt" > NOW() - INTERVAL '30 days'
    GROUP BY soi."cardName" ORDER BY revenue_cents DESC LIMIT 10
  `;

  const recentlySoldSql = `
    SELECT soi."cardName" as card_name, si.condition, soi."priceCents" as price_cents, so."createdAt" as sold_at
    FROM shop_order_items soi
    JOIN shop_orders so ON so.id = soi."orderId"
    LEFT JOIN shop_inventory si ON si.id = soi."inventoryId"
    WHERE so."shopId" = ? AND so.status = 'fulfilled'
    ORDER BY so."createdAt" DESC LIMIT 10
  `;

  const deadStockSql = `
    SELECT si.id, si."cardName" as card_name, si.condition, si.quantity, si."priceCents" as price_cents,
      EXTRACT(DAY FROM NOW() - COALESCE(last_sale.sold_at, si."createdAt"))::int as days_idle
    FROM shop_inventory si
    LEFT JOIN (
      SELECT soi."inventoryId" as inventory_id, MAX(so."createdAt") AS sold_at
      FROM shop_order_items soi
      JOIN shop_orders so ON so.id = soi."orderId"
      WHERE so.status = 'fulfilled'
      GROUP BY soi."inventoryId"
    ) last_sale ON last_sale.inventory_id = si.id
    WHERE si."shopId" = ?
      AND si.quantity > 0
      AND (last_sale.sold_at IS NULL OR last_sale.sold_at < NOW() - INTERVAL '60 days')
    ORDER BY si."priceCents" DESC
    LIMIT 20
  `;

  const deadStockTotalsSql = `
    SELECT COUNT(*)::int as count, COALESCE(SUM(si."priceCents" * si.quantity), 0) as value_cents
    FROM shop_inventory si
    LEFT JOIN (
      SELECT soi."inventoryId" as inventory_id, MAX(so."createdAt") AS sold_at
      FROM shop_order_items soi
      JOIN shop_orders so ON so.id = soi."orderId"
      WHERE so.status = 'fulfilled'
      GROUP BY soi."inventoryId"
    ) last_sale ON last_sale.inventory_id = si.id
    WHERE si."shopId" = ?
      AND si.quantity > 0
      AND (last_sale.sold_at IS NULL OR last_sale.sold_at < NOW() - INTERVAL '60 days')
  `;

  const [byUnitsRows, byRevenueRows, recentRows, deadRows, deadTotalsRow] = await Promise.all([
    findMany<TopSellerRow>(topByUnitsSql, [shopId]),
    findMany<TopSellerRow>(topByRevenueSql, [shopId]),
    findMany<RecentlySoldRow>(recentlySoldSql, [shopId]),
    findMany<DeadStockRow>(deadStockSql, [shopId]),
    findOne<DeadStockTotalsRow>(deadStockTotalsSql, [shopId]),
  ]);

  return NextResponse.json({
    topSellersByUnits: byUnitsRows.map(r => ({
      cardName: r.card_name,
      unitsSold: Number(r.units_sold),
      revenueCents: Number(r.revenue_cents),
    })),
    topSellersByRevenue: byRevenueRows.map(r => ({
      cardName: r.card_name,
      unitsSold: Number(r.units_sold),
      revenueCents: Number(r.revenue_cents),
    })),
    recentlySold: recentRows.map(r => ({
      cardName: r.card_name,
      condition: r.condition ?? '',
      priceCents: Number(r.price_cents),
      soldAt: r.sold_at,
    })),
    deadStock: deadRows.map(r => ({
      id: r.id,
      cardName: r.card_name,
      condition: r.condition,
      quantity: Number(r.quantity),
      priceCents: Number(r.price_cents),
      daysIdle: Number(r.days_idle),
    })),
    deadStockTotal: {
      count: Number(deadTotalsRow?.count ?? 0),
      valueCents: Number(deadTotalsRow?.value_cents ?? 0),
    },
    avgDaysToSell: [],
  });
}
