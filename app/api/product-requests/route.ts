import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';
import { notifyShopOwner } from '@/lib/marketplace/notify';

export const dynamic = 'force-dynamic';

interface ShopRow { id: string; name: string; user_id: string }
interface RequestRow {
  id: string; product_id: string; product_name: string; image_url: string | null;
  shop_id: string; shop_name: string; message: string | null;
  status: string; shop_response: string | null;
  responded_at: string | null; expires_at: string; created_at: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await findMany<RequestRow>(
    `SELECT pr.id, pr.product_id, p.name AS product_name, p.image_url,
            pr.shop_id, s.name AS shop_name, pr.message,
            pr.status, pr.shop_response,
            pr.responded_at::text, pr.expires_at::text, pr.created_at::text
     FROM product_requests pr
     JOIN mtg_products p ON p.id = pr.product_id
     JOIN shops s ON s.id = pr.shop_id
     WHERE pr.collector_user_id = ?
     ORDER BY pr.created_at DESC`,
    [userId]
  );

  return NextResponse.json({ requests: rows });
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) === 'shop_owner') {
    return NextResponse.json({ error: 'Shop owners cannot make product requests' }, { status: 403 });
  }

  const body = await req.json() as { productId: string; shopId: string; message?: string };
  if (!body.productId || !body.shopId) {
    return NextResponse.json({ error: 'productId and shopId required' }, { status: 400 });
  }

  const product = await findOne<{ id: string; name: string }>(
    `SELECT id, name FROM mtg_products WHERE id = ? AND is_active = true`,
    [body.productId]
  );
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const shop = await findOne<ShopRow>(
    `SELECT id, name, "userId" AS user_id FROM shops WHERE id = ?`,
    [body.shopId]
  );
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Check for existing open request from this collector to this shop for this product
  const existing = await findOne<{ id: string }>(
    `SELECT id FROM product_requests
     WHERE collector_user_id = ? AND shop_id = ? AND product_id = ? AND status = 'pending'`,
    [userId, body.shopId, body.productId]
  );
  if (existing) {
    return NextResponse.json({ error: 'You already have an open request for this product at this shop' }, { status: 409 });
  }

  const id = randomUUID();
  await run(
    `INSERT INTO product_requests (id, collector_user_id, shop_id, product_id, message)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, body.shopId, body.productId, body.message ?? null]
  );

  await notifyShopOwner(shop.id, shop.user_id, 'product_request', {
    title: 'New product request',
    body: `Someone is looking for ${product.name}`,
    ctaUrl: '/shop/products?tab=requests',
  });

  return NextResponse.json({ ok: true, id });
}
