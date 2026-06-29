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
  shop_lat: string;
  shop_lng: string;
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
      si."cardName" AS card_name,
      si."scryfallId" AS scryfall_id,
      si."setCode" AS set_code,
      si.condition,
      si.foil,
      si."priceCents"::text AS price_cents,
      si.quantity::text,
      si."imageUrl" AS image_url,
      s.id AS shop_id,
      s.name AS shop_name,
      s.slug AS shop_slug,
      s.lat::text AS shop_lat,
      s.lng::text AS shop_lng,
      (
        3959 * acos(
          LEAST(1.0, cos(radians(?)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians(?)) +
          sin(radians(?)) * sin(radians(s.lat::float)))
        )
      )::text AS distance_miles
    FROM shop_inventory si
    JOIN shops s ON s.id = si."shopId"
    WHERE si."cardName" ILIKE ?
      AND si.quantity > 0
      AND s.marketplace_active = true
      AND s.lat IS NOT NULL
      AND s.lng IS NOT NULL
      AND (
        3959 * acos(
          LEAST(1.0, cos(radians(?)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians(?)) +
          sin(radians(?)) * sin(radians(s.lat::float)))
        )
      ) <= ?
    ORDER BY distance_miles ASC, si."priceCents" ASC
    LIMIT 50
  `, [lat, lng, lat, `%${q}%`, lat, lng, lat, radius]);

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
      shopLat: parseFloat(r.shop_lat),
      shopLng: parseFloat(r.shop_lng),
      distanceMiles: parseFloat(parseFloat(r.distance_miles).toFixed(1)),
    })),
  });
}
