import { NextRequest, NextResponse } from 'next/server';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

interface ShopRow { id: string }

interface UnderpricedRow {
  inventory_id: string;
  card_name: string;
  condition: string;
  your_price_cents: string;
  tcg_cents: string;
  gap_pct: string;
}

interface GainerRow {
  card_name: string;
  condition: string;
  bought_at_cents: string;
  market_now_cents: string;
  gain_cents: string;
  gain_pct: string;
}

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

  const latestPriceSubquery = `
    SELECT DISTINCT ON ("scryfallId") "scryfallId", "priceCents"
    FROM card_price_snapshots
    ORDER BY "scryfallId", "capturedAt" DESC
  `;

  const [underpricedRows, overpricedRows, gainerRows, loserRows] = await Promise.all([
    findMany<UnderpricedRow>(
      `SELECT si.id as inventory_id, si."cardName" as card_name, si.condition,
              si."priceCents" as your_price_cents, snap."priceCents" as tcg_cents,
              ROUND(((si."priceCents"::numeric - snap."priceCents") / snap."priceCents") * 100, 1) as gap_pct
       FROM shop_inventory si
       JOIN (${latestPriceSubquery}) snap ON snap."scryfallId" = si."scryfallId"
       WHERE si."shopId" = ?
         AND si.quantity > 0
         AND snap."priceCents" > 0
         AND si."priceCents" < snap."priceCents" * 0.85
       ORDER BY gap_pct ASC
       LIMIT 15`,
      [shopId]
    ),
    findMany<UnderpricedRow>(
      `SELECT si.id as inventory_id, si."cardName" as card_name, si.condition,
              si."priceCents" as your_price_cents, snap."priceCents" as tcg_cents,
              ROUND(((si."priceCents"::numeric - snap."priceCents") / snap."priceCents") * 100, 1) as gap_pct
       FROM shop_inventory si
       JOIN (${latestPriceSubquery}) snap ON snap."scryfallId" = si."scryfallId"
       WHERE si."shopId" = ?
         AND si.quantity > 0
         AND snap."priceCents" > 0
         AND si."priceCents" > snap."priceCents" * 1.15
       ORDER BY gap_pct DESC
       LIMIT 15`,
      [shopId]
    ),
    findMany<GainerRow>(
      `SELECT card_name, condition, bought_at_cents, market_now_cents, gain_cents, gain_pct
       FROM (
         SELECT spi.card_name, spi.condition,
                AVG(spi.buy_price_cents) as bought_at_cents,
                snap."priceCents" as market_now_cents,
                snap."priceCents" - AVG(spi.buy_price_cents) as gain_cents,
                ROUND(((snap."priceCents" - AVG(spi.buy_price_cents))::numeric / AVG(spi.buy_price_cents)) * 100, 1) as gain_pct
         FROM shop_purchase_items spi
         JOIN shop_inventory si ON si."scryfallId" = spi.scryfall_id
           AND si.condition = spi.condition AND si."shopId" = ?
         JOIN (${latestPriceSubquery}) snap ON snap."scryfallId" = spi.scryfall_id
         GROUP BY spi.card_name, spi.condition, snap."priceCents"
         HAVING AVG(spi.buy_price_cents) > 0
       ) sub
       WHERE market_now_cents > bought_at_cents
       ORDER BY gain_cents DESC
       LIMIT 10`,
      [shopId]
    ),
    findMany<GainerRow>(
      `SELECT card_name, condition, bought_at_cents, market_now_cents, gain_cents, gain_pct
       FROM (
         SELECT spi.card_name, spi.condition,
                AVG(spi.buy_price_cents) as bought_at_cents,
                snap."priceCents" as market_now_cents,
                snap."priceCents" - AVG(spi.buy_price_cents) as gain_cents,
                ROUND(((snap."priceCents" - AVG(spi.buy_price_cents))::numeric / AVG(spi.buy_price_cents)) * 100, 1) as gain_pct
         FROM shop_purchase_items spi
         JOIN shop_inventory si ON si."scryfallId" = spi.scryfall_id
           AND si.condition = spi.condition AND si."shopId" = ?
         JOIN (${latestPriceSubquery}) snap ON snap."scryfallId" = spi.scryfall_id
         GROUP BY spi.card_name, spi.condition, snap."priceCents"
         HAVING AVG(spi.buy_price_cents) > 0
       ) sub
       WHERE market_now_cents < bought_at_cents
       ORDER BY gain_cents ASC
       LIMIT 10`,
      [shopId]
    ),
  ]);

  const underpriced = underpricedRows.map(r => ({
    inventoryId: r.inventory_id,
    cardName: r.card_name,
    condition: r.condition,
    yourPriceCents: Number(r.your_price_cents),
    tcgCents: Number(r.tcg_cents),
    gapPct: Number(r.gap_pct),
  }));

  const overpriced = overpricedRows.map(r => ({
    inventoryId: r.inventory_id,
    cardName: r.card_name,
    condition: r.condition,
    yourPriceCents: Number(r.your_price_cents),
    tcgCents: Number(r.tcg_cents),
    gapPct: Number(r.gap_pct),
  }));

  const gainers = gainerRows.map(r => ({
    cardName: r.card_name,
    condition: r.condition,
    boughtAtCents: Number(r.bought_at_cents),
    marketNowCents: Number(r.market_now_cents),
    gainCents: Number(r.gain_cents),
    gainPct: Number(r.gain_pct),
  }));

  const losers = loserRows.map(r => ({
    cardName: r.card_name,
    condition: r.condition,
    boughtAtCents: Number(r.bought_at_cents),
    marketNowCents: Number(r.market_now_cents),
    lossCents: Math.abs(Number(r.gain_cents)),
    lossPct: Math.abs(Number(r.gain_pct)),
  }));

  return NextResponse.json({ underpriced, overpriced, gainers, losers });
}
