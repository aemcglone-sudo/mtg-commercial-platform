import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ShopRow { id: string }
interface RequestRow {
  id: string; product_id: string; product_name: string;
  image_url: string | null; collector_email: string;
  message: string | null; status: string;
  shop_response: string | null; responded_at: string | null;
  expires_at: string; created_at: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<ShopRow>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ requests: [] });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') ?? 'pending';

  const rows = await findMany<RequestRow>(
    `SELECT pr.id, pr.product_id, p.name AS product_name, p.image_url,
            u.email AS collector_email, pr.message,
            pr.status, pr.shop_response,
            pr.responded_at::text, pr.expires_at::text, pr.created_at::text
     FROM product_requests pr
     JOIN mtg_products p ON p.id = pr.product_id
     JOIN users u ON u.id = pr.collector_user_id
     WHERE pr.shop_id = ? ${status !== 'all' ? 'AND pr.status = ?' : ''}
     ORDER BY pr.created_at DESC`,
    status !== 'all' ? [shop.id, status] : [shop.id]
  );

  return NextResponse.json({ requests: rows });
}
