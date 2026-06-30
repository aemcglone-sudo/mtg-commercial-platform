import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ShopRow { id: string }
interface ListingRow { id: string; shop_id: string }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const shop = await findOne<ShopRow>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const listing = await findOne<ListingRow>(
    `SELECT id, "shopId" AS shop_id FROM shop_products WHERE id = ?`,
    [id]
  );
  if (!listing || listing.shop_id !== shop.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json() as {
    quantity?: number;
    priceCents?: number;
    fulfillmentType?: string;
    notes?: string;
    isActive?: boolean;
  };

  type Arg = string | number | boolean | null;
  const sets: string[] = ['"updatedAt" = NOW()'];
  const vals: Arg[] = [];

  if (body.quantity != null) { sets.push(`quantity = ?`); vals.push(body.quantity); }
  if (body.priceCents != null) { sets.push(`"priceCents" = ?`); vals.push(body.priceCents); }
  if (body.fulfillmentType != null) { sets.push(`fulfillment_type = ?`); vals.push(body.fulfillmentType); }
  if (body.notes !== undefined) { sets.push(`notes = ?`); vals.push(body.notes ?? null); }
  if (body.isActive != null) { sets.push(`is_active = ?`); vals.push(body.isActive); }

  if (vals.length === 0) return NextResponse.json({ ok: true });

  await run(
    `UPDATE shop_products SET ${sets.join(', ')} WHERE id = ?`,
    [...vals, id]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const shop = await findOne<ShopRow>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const listing = await findOne<ListingRow>(
    `SELECT id, "shopId" AS shop_id FROM shop_products WHERE id = ?`,
    [id]
  );
  if (!listing || listing.shop_id !== shop.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await run(`DELETE FROM shop_products WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
