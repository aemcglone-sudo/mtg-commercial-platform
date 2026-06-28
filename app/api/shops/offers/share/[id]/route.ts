import { NextRequest, NextResponse } from 'next/server';
import { findOne } from '@/lib/db';

interface OfferRow {
  id: string;
  items: unknown;
  total_cents: number;
  rounded_total_cents: number;
  shop_name: string;
  expires_at: string;
  created_at: string;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const offer = await findOne<OfferRow>(
    `SELECT id, items, total_cents, rounded_total_cents, shop_name, expires_at, created_at
     FROM shop_offers WHERE id = ?`,
    [id]
  );

  if (!offer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: offer.id,
    items: typeof offer.items === 'string' ? JSON.parse(offer.items) : offer.items,
    totalCents: offer.total_cents,
    roundedTotalCents: offer.rounded_total_cents,
    shopName: offer.shop_name,
    expiresAt: offer.expires_at,
    createdAt: offer.created_at,
  });
}
