import { NextRequest, NextResponse } from 'next/server';
import { findOne } from '@/lib/db';

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
  tcgplayer_product_id: string | null;
  is_active: boolean;
  created_at: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await findOne<ProductRow>(
    `SELECT id, name, category, product_type, set_code, set_name,
            release_date::text, msrp_cents, image_url, description,
            tcgplayer_product_id, is_active, created_at::text
     FROM mtg_products
     WHERE id = ? AND is_active = true`,
    [id]
  );
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ product });
}
