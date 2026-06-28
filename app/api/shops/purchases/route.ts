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
  item_count: number;
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ purchases: [] });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await findMany<PurchaseRow>(
    `SELECT p.id, p.seller_name, p.seller_contact, p.total_paid_cents, p.notes, p.status, p.created_at,
            COUNT(pi.id)::int as item_count
     FROM shop_purchases p
     LEFT JOIN shop_purchase_items pi ON pi.purchase_id = p.id
     WHERE p.shop_id = ?
     GROUP BY p.id
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [shop.id, limit, offset]
  );

  return NextResponse.json({
    purchases: rows.map(r => ({
      id: r.id,
      sellerName: r.seller_name,
      sellerContact: r.seller_contact,
      totalPaidCents: r.total_paid_cents,
      notes: r.notes,
      status: r.status,
      createdAt: r.created_at,
      itemCount: r.item_count,
    })),
    page,
  });
}
