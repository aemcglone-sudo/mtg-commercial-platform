import { NextRequest, NextResponse } from 'next/server';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SearchRow {
  inventory_id: string;
  card_name: string;
  scryfall_id: string;
  set_code: string;
  condition: string;
  foil: boolean;
  price_cents: string;
  quantity: string;
  image_url: string;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  distance_miles: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = Math.min(100, Math.max(5, parseFloat(searchParams.get('radius') ?? '50')));

  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  if (isNaN(lat) || isNaN(lng)) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const rows = await findMany<SearchRow>(`
    SELECT
      si.id AS inventory_id,
      si.card_name,
      si.scryfall_id,
      si.set_code,
      si.condition,
      si.foil,
      si.price_cents::text,
      si.quantity::text,
      si.image_url,
      s.id AS shop_id,
      s.name AS shop_name,
      s.slug AS shop_slug,
      (
        3959 * acos(
          LEAST(1.0, cos(radians($1)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians($2)) +
          sin(radians($1)) * sin(radians(s.lat::float)))
        )
      )::text AS distance_miles
    FROM shop_inventory si
    JOIN shops s ON s.id = si.shop_id
    WHERE si.card_name ILIKE $3
      AND si.quantity > 0
      AND s.marketplace_active = true
      AND s.lat IS NOT NULL
      AND s.lng IS NOT NULL
      AND (
        3959 * acos(
          LEAST(1.0, cos(radians($1)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians($2)) +
          sin(radians($1)) * sin(radians(s.lat::float)))
        )
      ) <= $4
    ORDER BY distance_miles ASC, si.price_cents ASC
    LIMIT 50
  `, [lat, lng, `%${q}%`, radius]);

  return NextResponse.json({
    results: rows.map(r => ({
      inventoryId: r.inventory_id,
      cardName: r.card_name,
      scryfallId: r.scryfall_id,
      setCode: r.set_code,
      condition: r.condition,
      foil: r.foil,
      priceCents: parseInt(r.price_cents),
      quantity: parseInt(r.quantity),
      imageUrl: r.image_url,
      shopId: r.shop_id,
      shopName: r.shop_name,
      shopSlug: r.shop_slug,
      distanceMiles: parseFloat(parseFloat(r.distance_miles).toFixed(1)),
    })),
  });
}
