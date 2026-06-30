import { NextRequest, NextResponse } from 'next/server';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface CategoryRow {
  category: string;
  count: string;
}

export async function GET(_req: NextRequest) {
  const rows = await findMany<CategoryRow>(
    `SELECT p.category, COUNT(DISTINCT sp."productId")::text AS count
     FROM shop_products sp
     JOIN mtg_products p ON p.id = sp."productId"
     JOIN shops s ON s.id = sp."shopId"
     WHERE sp.is_active = true AND sp.quantity > 0 AND s.marketplace_active = true
     GROUP BY p.category
     ORDER BY count DESC, p.category ASC`
  );
  return NextResponse.json({ categories: rows });
}
