import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface InventoryMatch {
  id: string;
  card_name: string;
  condition: string;
  foil: boolean;
  price_cents: string;
  quantity: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const shop = await findOne<{ id: string }>(
    `SELECT id FROM shops WHERE slug = ? AND "isActive" = true`,
    [slug]
  );
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as { cards?: unknown };
  if (!Array.isArray(body.cards) || body.cards.length === 0) {
    return NextResponse.json({ error: 'cards must be a non-empty array' }, { status: 400 });
  }

  const names = (body.cards as unknown[])
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .slice(0, 50)
    .map(c => c.trim());

  if (names.length === 0) {
    return NextResponse.json({ error: 'No valid card names provided' }, { status: 400 });
  }

  // Build parameterized ILIKE ANY(ARRAY[...]) query
  const placeholders = names.map((_, i) => `$${i + 2}`).join(', ');
  const rows = await findMany<InventoryMatch>(
    `SELECT id, "cardName" AS card_name, condition, foil, "priceCents"::text AS price_cents, quantity
     FROM shop_inventory
     WHERE "shopId" = $1
       AND quantity > 0
       AND LOWER("cardName") = ANY(ARRAY[${placeholders}])
     ORDER BY "cardName", condition`,
    [shop.id, ...names.map(n => n.toLowerCase())]
  );

  // Group by lowercased requested name
  const byName = new Map<string, InventoryMatch[]>();
  for (const row of rows) {
    const key = row.card_name.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(row);
  }

  const results = names.map(name => {
    const items = byName.get(name.toLowerCase()) ?? [];
    return {
      name,
      found: items.length > 0,
      items: items.map(i => ({
        id: i.id,
        condition: i.condition,
        foil: i.foil,
        priceCents: parseInt(i.price_cents),
        quantity: i.quantity,
      })),
    };
  });

  return NextResponse.json({ results });
}
