import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

async function ensureShop(userId: string): Promise<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  isNew: boolean;
}> {
  let shop = await findOne<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
    isActive: boolean;
  }>('SELECT id, name, slug, description, address, city, state, phone, email, "websiteUrl", "isActive" FROM shops WHERE "userId" = ?', [userId]);

  if (!shop) {
    const shopId = randomUUID();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO shops (id, "userId", name, slug, "isActive", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, true, ?, ?)`,
      [shopId, userId, 'My Shop', `my-shop-${shopId.slice(0, 6)}`, now, now]
    );
    return { id: shopId, name: 'My Shop', slug: `my-shop-${shopId.slice(0, 6)}`, description: null, address: null, city: null, state: null, phone: null, email: null, websiteUrl: null, isActive: true, isNew: true };
  }

  const isNew = shop.name === 'My Shop' && !shop.description;
  return { ...shop, isNew };
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const userId = getAuthenticatedUserId(req)!;
    const shop = await ensureShop(userId);

    const inventoryRow = await findOne<{ count: string; total: string }>(
      'SELECT COUNT(*) as count, COALESCE(SUM("priceCents" * quantity), 0) as total FROM shop_inventory WHERE "shopId" = ?',
      [shop.id]
    );

    const orderRow = await findOne<{ pending: string; revenue: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COALESCE(SUM("totalCents") FILTER (WHERE status = 'paid' AND "createdAt" >= date_trunc('month', NOW())), 0) as revenue
       FROM shop_orders WHERE "shopId" = ?`,
      [shop.id]
    );

    return NextResponse.json({
      shop,
      stats: {
        inventoryCount: parseInt(inventoryRow?.count ?? '0', 10),
        totalValueCents: parseInt(inventoryRow?.total ?? '0', 10),
        pendingOrders: parseInt(orderRow?.pending ?? '0', 10),
        revenueThisMonthCents: parseInt(orderRow?.revenue ?? '0', 10),
      },
    });
  } catch (err) {
    console.error('/api/shops/me GET error:', err);
    return NextResponse.json({ shop: null, stats: null });
  }
}

export async function PATCH(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const userId = getAuthenticatedUserId(req)!;
    const shop = await ensureShop(userId);

    const body = await req.json() as {
      name?: string;
      description?: string;
      address?: string;
      city?: string;
      state?: string;
      phone?: string;
      email?: string;
      websiteUrl?: string;
      lat?: number;
      lng?: number;
    };

    const sets: string[] = [];
    const args: (string | number | null)[] = [];

    if (body.name !== undefined) { sets.push('name = ?'); args.push(body.name || null); }
    if (body.description !== undefined) { sets.push('description = ?'); args.push(body.description || null); }
    if (body.address !== undefined) { sets.push('address = ?'); args.push(body.address || null); }
    if (body.city !== undefined) { sets.push('city = ?'); args.push(body.city || null); }
    if (body.state !== undefined) { sets.push('state = ?'); args.push(body.state || null); }
    if (body.phone !== undefined) { sets.push('phone = ?'); args.push(body.phone || null); }
    if (body.email !== undefined) { sets.push('email = ?'); args.push(body.email || null); }
    if (body.websiteUrl !== undefined) { sets.push('"websiteUrl" = ?'); args.push(body.websiteUrl || null); }
    if (body.lat !== undefined) { sets.push('lat = ?'); args.push(body.lat); }
    if (body.lng !== undefined) { sets.push('lng = ?'); args.push(body.lng); }

    if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    sets.push('"updatedAt" = ?');
    args.push(new Date().toISOString());
    args.push(shop.id);

    await run(`UPDATE shops SET ${sets.join(', ')} WHERE id = ?`, args);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/shops/me PATCH error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
