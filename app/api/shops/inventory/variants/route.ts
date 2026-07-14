import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface InventoryVariant {
  condition: string;
  foil: boolean;
  quantity: number;
  priceCents: number;
}

export interface InventoryVariantCard {
  cardName: string;
  scryfallId: string;
  imageUrl: string | null;
  totalQuantity: number;
  variants: InventoryVariant[];
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Cards with more than one row = multiple variants (different condition/foil combos)
  const rows = await findMany<{
    cardName: string;
    scryfallId: string;
    imageUrl: string | null;
    condition: string;
    foil: boolean;
    quantity: number;
    priceCents: number;
    variantCount: number;
  }>(
    `SELECT
       si."cardName",
       si."scryfallId",
       si."imageUrl",
       si.condition,
       si.foil,
       si.quantity,
       si."priceCents",
       COUNT(*) OVER (PARTITION BY si."cardName") AS "variantCount"
     FROM shop_inventory si
     WHERE si."shopId" = ?
       AND (SELECT COUNT(*) FROM shop_inventory si2
            WHERE si2."shopId" = si."shopId" AND si2."cardName" = si."cardName") > 1
     ORDER BY si."cardName", si.condition, si.foil`,
    [shop.id]
  );

  // Group by card name
  const cardMap = new Map<string, InventoryVariantCard>();
  for (const row of rows) {
    if (!cardMap.has(row.cardName)) {
      cardMap.set(row.cardName, {
        cardName: row.cardName,
        scryfallId: row.scryfallId,
        imageUrl: row.imageUrl,
        totalQuantity: 0,
        variants: [],
      });
    }
    const card = cardMap.get(row.cardName)!;
    card.totalQuantity += Number(row.quantity);
    card.variants.push({
      condition: row.condition,
      foil: row.foil,
      quantity: Number(row.quantity),
      priceCents: Number(row.priceCents),
    });
  }

  return NextResponse.json({ cards: [...cardMap.values()] });
}
