import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

interface PurchaseRow {
  id: string;
  seller_name: string | null;
  seller_contact: string | null;
  total_paid_cents: number;
  notes: string | null;
  status: string;
  created_at: string;
}

interface PurchaseItemRow {
  id: string;
  scryfall_id: string;
  card_name: string;
  set_code: string;
  condition: string;
  foil: boolean;
  quantity: number;
  buy_price_cents: number;
  tcg_market_cents: number;
  target_sell_price_cents: number | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { id } = await params;

  const purchase = await findOne<PurchaseRow>(
    'SELECT * FROM shop_purchases WHERE id = ? AND shop_id = ?',
    [id, shop.id]
  );
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const items = await findMany<PurchaseItemRow>(
    'SELECT * FROM shop_purchase_items WHERE purchase_id = ?',
    [id]
  );

  return NextResponse.json({
    id: purchase.id,
    sellerName: purchase.seller_name,
    sellerContact: purchase.seller_contact,
    totalPaidCents: purchase.total_paid_cents,
    notes: purchase.notes,
    status: purchase.status,
    createdAt: purchase.created_at,
    items: items.map(i => ({
      id: i.id,
      scryfallId: i.scryfall_id,
      cardName: i.card_name,
      setCode: i.set_code,
      condition: i.condition,
      foil: i.foil,
      quantity: i.quantity,
      buyPriceCents: i.buy_price_cents,
      tcgMarketCents: i.tcg_market_cents,
      targetSellPriceCents: i.target_sell_price_cents,
    })),
  });
}
