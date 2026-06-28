import { NextRequest, NextResponse } from 'next/server';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

interface ShopRow { id: string }
interface InventoryValueRow { value: string; total_units: string }
interface CostRow { cost_cents: string }
interface UnitsSoldRow { units: string }
interface RarityRow { rarity: string; margin_cents: string }

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

  const [invRow, costRow, soldRow, rarityRows] = await Promise.all([
    findOne<InventoryValueRow>(
      `SELECT COALESCE(SUM("priceCents" * quantity), 0) as value, COALESCE(SUM(quantity), 0) as total_units
       FROM shop_inventory WHERE "shopId" = ? AND quantity > 0`,
      [shopId]
    ),
    findOne<CostRow>(
      `SELECT COALESCE(SUM(spi.buy_price_cents * si.quantity), 0) as cost_cents
       FROM shop_inventory si
       JOIN (
         SELECT scryfall_id, condition, AVG(buy_price_cents) as buy_price_cents
         FROM shop_purchase_items
         GROUP BY scryfall_id, condition
       ) spi ON spi.scryfall_id = si."scryfallId" AND spi.condition = si.condition
       WHERE si."shopId" = ?`,
      [shopId]
    ),
    findOne<UnitsSoldRow>(
      `SELECT COALESCE(SUM(soi.quantity), 0) as units
       FROM shop_order_items soi
       JOIN shop_orders so ON so.id = soi."orderId"
       WHERE so."shopId" = ? AND so.status = 'fulfilled' AND so."createdAt" > NOW() - INTERVAL '30 days'`,
      [shopId]
    ),
    findMany<RarityRow>(
      `SELECT
         COALESCE(si.rarity, 'unknown') as rarity,
         COALESCE(SUM((si."priceCents" - COALESCE(spi.buy_price_cents, 0)) * si.quantity), 0) as margin_cents
       FROM shop_inventory si
       LEFT JOIN (
         SELECT scryfall_id, condition, AVG(buy_price_cents) as buy_price_cents
         FROM shop_purchase_items GROUP BY scryfall_id, condition
       ) spi ON spi.scryfall_id = si."scryfallId" AND spi.condition = si.condition
       WHERE si."shopId" = ? AND quantity > 0
       GROUP BY si.rarity
       ORDER BY margin_cents DESC`,
      [shopId]
    ),
  ]);

  const inventoryValueCents = Number(invRow?.value ?? 0);
  const totalUnits = Number(invRow?.total_units ?? 0);
  const costBasisCents = Number(costRow?.cost_cents ?? 0);
  const unitsSoldThisMonth = Number(soldRow?.units ?? 0);

  const potentialMarginCents = inventoryValueCents - costBasisCents;
  const potentialMarginPct = inventoryValueCents > 0
    ? (potentialMarginCents / inventoryValueCents) * 100
    : 0;
  const turnoverRatePct = totalUnits > 0
    ? (unitsSoldThisMonth / totalUnits) * 100
    : 0;

  const rarityMargin = rarityRows.map(r => {
    const marginCents = Number(r.margin_cents);
    const pct = inventoryValueCents > 0 ? (marginCents / inventoryValueCents) * 100 : 0;
    return { rarity: r.rarity, marginCents, pct };
  });

  return NextResponse.json({
    inventoryValueCents,
    costBasisCents,
    potentialMarginCents,
    potentialMarginPct,
    turnoverRatePct,
    totalUnits,
    unitsSoldThisMonth,
    rarityMargin,
  });
}
