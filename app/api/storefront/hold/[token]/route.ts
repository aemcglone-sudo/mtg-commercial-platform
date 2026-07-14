import { NextRequest, NextResponse } from 'next/server';
import { findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const hold = await findOne<{
    id: string;
    status: string;
    card_name: string;
    condition: string;
    foil: boolean;
    price_cents: string;
    guest_name: string | null;
    guest_email: string | null;
    shop_name: string;
    shop_slug: string;
    request_expires_at: string | null;
    created_at: string;
  }>(
    `SELECT h.id, h.status, h.card_name, h.condition, h.foil,
            h.price_cents::text, h.guest_name, h.guest_email,
            s.name AS shop_name, s.slug AS shop_slug,
            h.request_expires_at::text, h.created_at::text
     FROM holds h
     JOIN shops s ON s.id = h.shop_id
     WHERE h.guest_token = ?`,
    [token]
  );

  if (!hold) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    holdId: hold.id,
    status: hold.status,
    cardName: hold.card_name,
    condition: hold.condition,
    foil: hold.foil,
    priceCents: parseInt(hold.price_cents),
    guestName: hold.guest_name,
    shopName: hold.shop_name,
    shopSlug: hold.shop_slug,
    requestExpiresAt: hold.request_expires_at,
    createdAt: hold.created_at,
  });
}
