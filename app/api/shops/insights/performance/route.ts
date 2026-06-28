import { NextRequest, NextResponse } from 'next/server';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

interface ShopRow { id: string }

interface SummaryRow {
  revenue_cents: string;
  cost_cents: string;
  order_count: string;
}

interface MonthlyRow {
  month: string;
  year: string;
  month_num: string;
  revenue_cents: string;
  cost_cents: string;
}

interface BestBuyRow {
  card_name: string;
  condition: string;
  paid_cents: string;
  market_now_cents: string;
  gain_cents: string;
  gain_pct: string;
}

interface SourceRow {
  source: string;
  total_cents: string;
}

const latestPriceSubquery = `
  SELECT DISTINCT ON ("scryfallId") "scryfallId", "priceCents"
  FROM card_price_snapshots
  ORDER BY "scryfallId", "capturedAt" DESC
`;

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

  const { searchParams } = new URL(req.url);
  const period = ['30', '60', '90'].includes(searchParams.get('period') ?? '') ? searchParams.get('period')! : '30';
  const monthsRaw = parseInt(searchParams.get('months') ?? '6', 10);
  const months = [3, 6, 12].includes(monthsRaw) ? monthsRaw : 6;

  const [summaryRow, monthlyRows, bestBuyRows, worstBuyRows, sourceRows] = await Promise.all([
    findOne<SummaryRow>(
      `SELECT
         COALESCE(SUM(soi."priceCents" * soi.quantity), 0) as revenue_cents,
         COALESCE(SUM(spi.buy_price_cents * soi.quantity), 0) as cost_cents,
         COUNT(DISTINCT so.id) as order_count
       FROM shop_orders so
       JOIN shop_order_items soi ON soi."orderId" = so.id
       LEFT JOIN shop_purchase_items spi ON spi.scryfall_id = (
         SELECT si."scryfallId" FROM shop_inventory si WHERE si.id = soi."inventoryId" LIMIT 1
       ) AND spi.condition = (
         SELECT si.condition FROM shop_inventory si WHERE si.id = soi."inventoryId" LIMIT 1
       )
       WHERE so."shopId" = ?
         AND so.status = 'fulfilled'
         AND so."createdAt" > NOW() - (? || ' days')::interval`,
      [shopId, period]
    ),
    findMany<MonthlyRow>(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', so."createdAt"), 'Mon') as month,
         EXTRACT(YEAR FROM so."createdAt")::int as year,
         EXTRACT(MONTH FROM so."createdAt")::int as month_num,
         COALESCE(SUM(soi."priceCents" * soi.quantity), 0) as revenue_cents,
         COALESCE(SUM(spi.buy_price_cents * soi.quantity), 0) as cost_cents
       FROM shop_orders so
       JOIN shop_order_items soi ON soi."orderId" = so.id
       LEFT JOIN shop_purchase_items spi ON spi.scryfall_id = (
         SELECT si."scryfallId" FROM shop_inventory si WHERE si.id = soi."inventoryId" LIMIT 1
       ) AND spi.condition = (
         SELECT si.condition FROM shop_inventory si WHERE si.id = soi."inventoryId" LIMIT 1
       )
       WHERE so."shopId" = ?
         AND so.status = 'fulfilled'
         AND so."createdAt" > NOW() - (? || ' months')::interval
       GROUP BY DATE_TRUNC('month', so."createdAt"), month, year, month_num
       ORDER BY DATE_TRUNC('month', so."createdAt") ASC`,
      [shopId, months]
    ),
    findMany<BestBuyRow>(
      `SELECT
         spi.card_name,
         spi.condition,
         AVG(spi.buy_price_cents)::int as paid_cents,
         snap."priceCents" as market_now_cents,
         (snap."priceCents" - AVG(spi.buy_price_cents))::int as gain_cents,
         ROUND(((snap."priceCents" - AVG(spi.buy_price_cents))::numeric / NULLIF(AVG(spi.buy_price_cents), 0)) * 100, 1) as gain_pct
       FROM shop_purchase_items spi
       JOIN shop_purchases sp ON sp.id = spi.purchase_id
       JOIN (${latestPriceSubquery}) snap ON snap."scryfallId" = spi.scryfall_id
       WHERE sp.shop_id = ?
       GROUP BY spi.card_name, spi.condition, snap."priceCents"
       HAVING snap."priceCents" > AVG(spi.buy_price_cents)
       ORDER BY gain_cents DESC LIMIT 8`,
      [shopId]
    ),
    findMany<BestBuyRow>(
      `SELECT
         spi.card_name,
         spi.condition,
         AVG(spi.buy_price_cents)::int as paid_cents,
         snap."priceCents" as market_now_cents,
         (AVG(spi.buy_price_cents) - snap."priceCents")::int as gain_cents,
         ROUND(((AVG(spi.buy_price_cents) - snap."priceCents")::numeric / NULLIF(AVG(spi.buy_price_cents), 0)) * 100, 1) as gain_pct
       FROM shop_purchase_items spi
       JOIN shop_purchases sp ON sp.id = spi.purchase_id
       JOIN (${latestPriceSubquery}) snap ON snap."scryfallId" = spi.scryfall_id
       WHERE sp.shop_id = ?
       GROUP BY spi.card_name, spi.condition, snap."priceCents"
       HAVING snap."priceCents" < AVG(spi.buy_price_cents)
       ORDER BY gain_cents DESC LIMIT 8`,
      [shopId]
    ),
    findMany<SourceRow>(
      `SELECT
         CASE
           WHEN seller_name ILIKE '%walk-in%' OR seller_name ILIKE '%walk in%' THEN 'Walk-in purchases'
           WHEN seller_name ILIKE '%collection%' OR seller_name ILIKE '%estate%' THEN 'Collection buys'
           WHEN seller_name IS NULL OR seller_name = '' THEN 'Unknown'
           ELSE 'Other'
         END as source,
         SUM(total_paid_cents) as total_cents
       FROM shop_purchases
       WHERE shop_id = ?
       GROUP BY source
       ORDER BY total_cents DESC`,
      [shopId]
    ),
  ]);

  const revenueCents = Number(summaryRow?.revenue_cents ?? 0);
  const costCents = Number(summaryRow?.cost_cents ?? 0);
  const grossProfitCents = revenueCents - costCents;
  const orderCount = Number(summaryRow?.order_count ?? 0);
  const avgMarginPct = revenueCents > 0 ? (grossProfitCents / revenueCents) * 100 : 0;

  const monthly = monthlyRows.map(r => {
    const rev = Number(r.revenue_cents);
    const cost = Number(r.cost_cents);
    const profit = rev - cost;
    return {
      month: r.month,
      year: Number(r.year),
      revenueCents: rev,
      costCents: cost,
      grossProfitCents: profit,
      marginPct: rev > 0 ? (profit / rev) * 100 : 0,
    };
  });

  const bestBuys = bestBuyRows.map(r => ({
    cardName: r.card_name,
    condition: r.condition,
    paidCents: Number(r.paid_cents),
    marketNowCents: Number(r.market_now_cents),
    gainCents: Number(r.gain_cents),
    gainPct: Number(r.gain_pct),
  }));

  const worstBuys = worstBuyRows.map(r => ({
    cardName: r.card_name,
    condition: r.condition,
    paidCents: Number(r.paid_cents),
    marketNowCents: Number(r.market_now_cents),
    lossCents: Number(r.gain_cents),
    lossPct: Number(r.gain_pct),
  }));

  const grandTotal = sourceRows.reduce((sum, r) => sum + Number(r.total_cents), 0);
  const bySource = sourceRows.map(r => ({
    source: r.source,
    totalCents: Number(r.total_cents),
    pct: grandTotal > 0 ? (Number(r.total_cents) / grandTotal) * 100 : 0,
  }));

  return NextResponse.json({
    summary: {
      revenueCents,
      costCents,
      grossProfitCents,
      avgMarginPct,
      targetMarginPct: 40,
      orderCount,
    },
    monthly,
    bestBuys,
    worstBuys,
    bySource,
  });
}
