import { NextRequest, NextResponse } from 'next/server';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  name: string;
  category: string;
  product_type: string;
  set_code: string | null;
  set_name: string | null;
  msrp_cents: number | null;
  image_url: string | null;
  nearby_count: string;
  shop_names: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const category = searchParams.get('category')?.trim() ?? '';
  const type = searchParams.get('type')?.trim() ?? '';
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = parseFloat(searchParams.get('radius') ?? '50');

  type Arg = string | number | boolean | null;
  const params: Arg[] = [];
  const wheres: string[] = [
    'sp.is_active = true',
    'sp.quantity > 0',
    's.marketplace_active = true',
  ];
  if (category) { wheres.push('p.category = ?'); params.push(category); }
  if (type) { wheres.push('p.product_type = ?'); params.push(type); }
  if (q) {
    const stem = q.replace(/s$/i, '');
    const like = `%${stem}%`;
    wheres.push(`(p.name ILIKE ? OR p.set_name ILIKE ? OR p.category ILIKE ?)`);
    params.push(like, like, like);
  }
  const where = `WHERE ${wheres.join(' AND ')}`;

  const hasLocation = !isNaN(lat) && !isNaN(lng);

  const nearbyExpr = hasLocation
    ? `3959 * acos(
         cos(radians(${lat})) * cos(radians(s.lat::float)) *
         cos(radians(s.lng::float) - radians(${lng})) +
         sin(radians(${lat})) * sin(radians(s.lat::float))
       ) <= ${radius}`
    : 'true';

  const rows = await findMany<ProductRow>(
    `SELECT p.id, p.name, p.category, p.product_type, p.set_code, p.set_name,
            p.msrp_cents, p.image_url,
            COUNT(DISTINCT sp."shopId")::text AS nearby_count,
            STRING_AGG(DISTINCT s.name, ', ' ORDER BY s.name) AS shop_names
     FROM shop_products sp
     JOIN mtg_products p ON p.id = sp."productId"
     JOIN shops s ON s.id = sp."shopId"
     ${where}
     GROUP BY p.id, p.name, p.category, p.product_type, p.set_code, p.set_name, p.msrp_cents, p.image_url
     ORDER BY nearby_count DESC, p.set_code DESC NULLS LAST, p.name ASC
     LIMIT 48`,
    params
  );

  return NextResponse.json({ products: rows.map(r => ({ ...r, nearby_count: parseInt(r.nearby_count) })) });
}
