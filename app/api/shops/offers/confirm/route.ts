import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { randomUUID } from 'crypto';

interface OfferItem {
  scryfallId: string;
  cardName: string;
  setCode: string;
  condition: string;
  foil: boolean;
  qty: number;
  tcgCents: number;
  buyPriceCents: number;
  imageUrl: string | null;
  rarity?: string | null;
  typeLine?: string | null;
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string; condition_matrix: unknown }>(
    'SELECT id, condition_matrix FROM shops WHERE "userId" = ?',
    [userId]
  );
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as {
    items: OfferItem[];
    totalPaidCents: number;
    sellerName?: string;
    sellerContact?: string;
    notes?: string;
  };

  const purchaseId = randomUUID();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO shop_purchases (id, shop_id, seller_name, seller_contact, total_paid_cents, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
    [purchaseId, shop.id, body.sellerName ?? null, body.sellerContact ?? null, body.totalPaidCents, body.notes ?? null, now]
  );

  const matrix = (typeof shop.condition_matrix === 'string'
    ? JSON.parse(shop.condition_matrix)
    : shop.condition_matrix) as Record<string, number> ?? { NM: 100, LP: 85, MP: 70, HP: 50, DMG: 25 };

  const inventoryCards: unknown[] = [];

  for (const item of body.items) {
    const itemId = randomUUID();
    const condPct = matrix[item.condition] ?? 100;
    const targetSellCents = Math.round(item.tcgCents * condPct / 100 * 1.4);

    await run(
      `INSERT INTO shop_purchase_items
        (id, purchase_id, scryfall_id, card_name, set_code, condition, foil, quantity, buy_price_cents, tcg_market_cents, target_sell_price_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, purchaseId, item.scryfallId, item.cardName, item.setCode, item.condition, item.foil, item.qty, item.buyPriceCents, item.tcgCents, targetSellCents]
    );

    inventoryCards.push({
      scryfallId: item.scryfallId,
      cardName: item.cardName,
      setCode: item.setCode,
      condition: item.condition,
      foil: item.foil,
      quantity: item.qty,
      priceCents: targetSellCents,
      imageUrl: item.imageUrl,
      typeLine: item.typeLine ?? null,
      rarity: item.rarity ?? null,
    });
  }

  // Add to inventory
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  await fetch(`${baseUrl}/api/shops/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') ?? '' },
    body: JSON.stringify({ cards: inventoryCards }),
  }).catch(() => {});

  return NextResponse.json({ purchaseId });
}
