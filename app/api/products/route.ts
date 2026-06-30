import { NextRequest, NextResponse } from 'next/server';
import { findMany, findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  name: string;
  category: string;
  product_type: string;
  set_code: string | null;
  set_name: string | null;
  release_date: string | null;
  msrp_cents: number | null;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface CountRow { total: string }

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const category = searchParams.get('category') ?? '';
  const type = searchParams.get('type') ?? '';
  const set_code = searchParams.get('set_code') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(48, parseInt(searchParams.get('limit') ?? '24'));
  const offset = (page - 1) * limit;

  const wheres: string[] = ['p.is_active = true'];
  type Arg = string | number | boolean | null;
  const params: Arg[] = [];

  if (q) {
    const stem = q.replace(/s$/i, '');
    const like = `%${stem}%`;
    wheres.push(`(p.name ILIKE ? OR p.set_name ILIKE ? OR p.description ILIKE ? OR p.category ILIKE ?)`);
    params.push(like, like, like, like);
  }
  if (category) { wheres.push(`p.category = ?`); params.push(category); }
  if (type) { wheres.push(`p.product_type = ?`); params.push(type); }
  if (set_code) { wheres.push(`p.set_code = ?`); params.push(set_code); }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

  const countRow = await findOne<CountRow>(
    `SELECT COUNT(*)::text AS total FROM mtg_products p ${where}`,
    params
  );
  const total = parseInt(countRow?.total ?? '0');

  const items = await findMany<ProductRow>(
    `SELECT p.id, p.name, p.category, p.product_type, p.set_code, p.set_name,
            p.release_date::text, p.msrp_cents, p.image_url, p.description, p.is_active,
            p.created_at::text
     FROM mtg_products p
     ${where}
     ORDER BY p.set_code DESC NULLS LAST, p.name ASC
     LIMIT ? OFFSET ?`,
    ([...params, limit, offset] as Arg[])
  );

  return NextResponse.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
