import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/storefront/[slug]/inventory?q=lightning
// Public — no auth required
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ items: [] });

  const shop = await findOne<{ id: string }>(
    `SELECT id FROM shops WHERE slug = ? AND "isActive" = true`,
    [slug]
  );
  if (!shop) return NextResponse.json({ items: [] });

  const rows = await findMany<{
    id: string; card_name: string; condition: string; foil: boolean;
    price_cents: string; quantity: string; image_url: string | null; scryfall_id: string;
    set_code: string; rarity: string | null;
  }>(
    `SELECT id, "cardName" AS card_name, condition, foil,
            "priceCents"::text AS price_cents, quantity::text,
            "imageUrl" AS image_url, "scryfallId" AS scryfall_id,
            "setCode" AS set_code, rarity
     FROM shop_inventory
     WHERE "shopId" = ? AND quantity > 0 AND LOWER("cardName") LIKE ?
     ORDER BY "cardName" ASC
     LIMIT 100`,
    [shop.id, `%${q.toLowerCase()}%`]
  );

  return NextResponse.json({
    items: rows.map(r => ({
      id: r.id,
      cardName: r.card_name,
      condition: r.condition,
      foil: r.foil,
      priceCents: parseInt(r.price_cents),
      quantity: parseInt(r.quantity),
      setCode: r.set_code,
      rarity: r.rarity,
      imageUrl: r.image_url ?? (r.scryfall_id
        ? `https://cards.scryfall.io/normal/front/${r.scryfall_id[0]}/${r.scryfall_id[1]}/${r.scryfall_id}.jpg`
        : null),
    })),
  });
}
