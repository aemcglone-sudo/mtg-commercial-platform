import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface ShopRow { id: string }

interface ListingRow {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  product_type: string;
  set_code: string | null;
  set_name: string | null;
  msrp_cents: number | null;
  image_url: string | null;
  quantity: number;
  price_cents: string;
  fulfillment_type: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface CountRow { total: string }

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<ShopRow>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const category = searchParams.get('category') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 24;
  const offset = (page - 1) * limit;

  const wheres = [`sp."shopId" = ?`];
  type Arg = string | number | boolean | null;
  const params: Arg[] = [shop.id];

  if (q) {
    const stem = q.replace(/s$/i, '');
    wheres.push(`(p.name ILIKE ? OR p.category ILIKE ?)`);
    params.push(`%${stem}%`, `%${stem}%`);
  }
  if (category) {
    wheres.push(`p.category = ?`);
    params.push(category);
  }

  const where = `WHERE ${wheres.join(' AND ')}`;

  const countRow = await findOne<CountRow>(
    `SELECT COUNT(*)::text AS total
     FROM shop_products sp JOIN mtg_products p ON p.id = sp."productId"
     ${where}`,
    params
  );
  const total = parseInt(countRow?.total ?? '0');

  const rows = await findMany<ListingRow>(
    `SELECT sp.id, sp."productId" AS product_id, p.name AS product_name,
            p.category, p.product_type, p.set_code, p.set_name,
            p.msrp_cents, p.image_url,
            sp.quantity, sp."priceCents"::text AS price_cents,
            sp.fulfillment_type, sp.notes, sp.is_active,
            sp."createdAt"::text AS created_at
     FROM shop_products sp JOIN mtg_products p ON p.id = sp."productId"
     ${where}
     ORDER BY p.name ASC
     LIMIT ? OFFSET ?`,
    ([...params, limit, offset] as Arg[])
  );

  return NextResponse.json({ listings: rows, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<ShopRow>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as {
    productId?: string;
    name?: string;
    category?: string;
    productType?: string;
    quantity: number;
    priceCents: number;
    fulfillmentType?: string;
    notes?: string;
  };

  if (body.quantity == null || body.priceCents == null) {
    return NextResponse.json({ error: 'quantity and priceCents are required' }, { status: 400 });
  }

  let productId = body.productId;

  if (!productId) {
    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'name and category are required when productId is not provided' }, { status: 400 });
    }
    const newId = randomUUID();
    await run(
      `INSERT INTO mtg_products (id, name, category, product_type, is_active)
       VALUES (?, ?, ?, ?, true)`,
      [newId, body.name.trim(), body.category, body.productType ?? 'sealed']
    );
    productId = newId;
  } else {
    const product = await findOne<{ id: string }>(
      `SELECT id FROM mtg_products WHERE id = ? AND is_active = true`,
      [productId]
    );
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const id = randomUUID();
  await run(
    `INSERT INTO shop_products (id, "shopId", "productId", quantity, "priceCents", fulfillment_type, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT ("shopId", "productId") DO UPDATE
       SET quantity = EXCLUDED.quantity,
           "priceCents" = EXCLUDED."priceCents",
           fulfillment_type = EXCLUDED.fulfillment_type,
           notes = EXCLUDED.notes,
           is_active = true,
           "updatedAt" = NOW()`,
    [
      id, shop.id, productId,
      body.quantity, body.priceCents,
      body.fulfillmentType ?? 'pickup',
      body.notes ?? null,
    ]
  );

  return NextResponse.json({ ok: true, id });
}
