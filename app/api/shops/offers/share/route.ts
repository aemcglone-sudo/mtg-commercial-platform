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
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string; name: string }>('SELECT id, name FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as {
    items: OfferItem[];
    totalCents: number;
    roundedTotalCents: number;
  };

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  await run(
    `INSERT INTO shop_offers (id, shop_id, items, total_cents, rounded_total_cents, shop_name, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, shop.id, JSON.stringify(body.items), body.totalCents, body.roundedTotalCents, shop.name, expiresAt]
  );

  return NextResponse.json({ id });
}
