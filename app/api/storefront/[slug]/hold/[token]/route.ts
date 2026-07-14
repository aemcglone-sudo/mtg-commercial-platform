import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface HoldRow {
  id: string;
  status: string;
  card_name: string;
  condition: string;
  foil: boolean;
  price_cents: string;
  guest_name: string | null;
  guest_email: string | null;
  shop_name: string;
  request_expires_at: string | null;
  created_at: string;
}

async function resolveHold(slug: string, token: string) {
  return findOne<HoldRow>(
    `SELECT h.id, h.status, h.card_name, h.condition, h.foil,
            h.price_cents::text, h.guest_name, h.guest_email,
            s.name AS shop_name,
            h.request_expires_at::text, h.created_at::text
     FROM holds h
     JOIN shops s ON s.id = h.shop_id
     WHERE h.guest_token = ? AND s.slug = ?`,
    [token, slug]
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await params;
  const hold = await resolveHold(slug, token);
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
    requestExpiresAt: hold.request_expires_at,
    createdAt: hold.created_at,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await params;
  const hold = await resolveHold(slug, token);
  if (!hold) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { action: string };
  if (body.action !== 'cancel') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if (!['requested', 'confirmed'].includes(hold.status)) {
    return NextResponse.json({ error: 'Hold cannot be cancelled in its current state' }, { status: 422 });
  }

  await run(`UPDATE holds SET status = 'cancelled', updated_at = NOW() WHERE id = ?`, [hold.id]);
  return NextResponse.json({ ok: true });
}
