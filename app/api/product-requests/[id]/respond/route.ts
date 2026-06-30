import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { notifyCollector } from '@/lib/marketplace/notify';

export const dynamic = 'force-dynamic';

interface ShopRow { id: string }
interface RequestRow {
  id: string; collector_user_id: string; shop_id: string;
  product_id: string; product_name: string; status: string;
}

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

  const request = await findOne<RequestRow>(
    `SELECT pr.id, pr.collector_user_id, pr.shop_id, pr.product_id,
            p.name AS product_name, pr.status
     FROM product_requests pr
     JOIN mtg_products p ON p.id = pr.product_id
     WHERE pr.id = ?`,
    [id]
  );
  if (!request || request.shop_id !== shop.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'Request already responded to' }, { status: 409 });
  }

  const body = await req.json() as { status: 'available' | 'declined'; shopResponse?: string };
  if (!['available', 'declined'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be available or declined' }, { status: 400 });
  }

  await run(
    `UPDATE product_requests
     SET status = ?, shop_response = ?, responded_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [body.status, body.shopResponse ?? null, id]
  );

  const notifBody = body.status === 'available'
    ? `Good news! The shop has ${request.product_name} available.`
    : `The shop cannot fulfill your request for ${request.product_name}.`;

  await notifyCollector(request.collector_user_id, 'product_request_response', {
    title: body.status === 'available' ? 'Product available!' : 'Product request update',
    body: notifBody,
    ctaUrl: '/profile/product-requests',
  });

  return NextResponse.json({ ok: true });
}
