import { NextRequest, NextResponse } from 'next/server';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ShopCardRow {
  inventory_id: string;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  shop_address: string;
  shop_city: string;
  shop_state: string;
  shop_phone: string;
  hold_instructions: string;
  shop_lat: string;
  shop_lng: string;
  condition: string;
  foil: boolean;
  quantity: string;
  price_cents: string;
  image_url: string;
  set_code: string;
  collector_number: string;
  distance_miles: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scryfallId: string }> }
) {
  const { scryfallId } = await params;
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = Math.min(100, Math.max(5, parseFloat(searchParams.get('radius') ?? '50')));

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const rows = await findMany<ShopCardRow>(`
    SELECT
      si.id AS inventory_id,
      s.id AS shop_id,
      s.name AS shop_name,
      s.slug AS shop_slug,
      s.address AS shop_address,
      s.city AS shop_city,
      s.state AS shop_state,
      s.phone AS shop_phone,
      s.hold_instructions,
      s.lat::text AS shop_lat,
      s.lng::text AS shop_lng,
      si.condition,
      si.foil,
      si.quantity::text,
      si."priceCents"::text AS price_cents,
      si."imageUrl" AS image_url,
      si."setCode" AS set_code,
      si."collectorNumber" AS collector_number,
      (
        3959 * acos(
          LEAST(1.0, cos(radians(?)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians(?)) +
          sin(radians(?)) * sin(radians(s.lat::float)))
        )
      )::text AS distance_miles
    FROM shop_inventory si
    JOIN shops s ON s.id = si."shopId"
    WHERE si."scryfallId" = ?
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
  `, [lat, lng, lat, scryfallId, lat, lng, lat, radius]);

  return NextResponse.json({
    results: rows.map(r => ({
      inventoryId: r.inventory_id,
      shopId: r.shop_id,
      shopName: r.shop_name,
      shopSlug: r.shop_slug,
      address: [r.shop_address, r.shop_city, r.shop_state].filter(Boolean).join(', '),
      phone: r.shop_phone,
      holdInstructions: r.hold_instructions,
      condition: r.condition,
      foil: r.foil,
      quantity: parseInt(r.quantity),
      priceCents: parseInt(r.price_cents),
      imageUrl: r.image_url,
      setCode: r.set_code,
      collectorNumber: r.collector_number,
      distanceMiles: parseFloat(parseFloat(r.distance_miles).toFixed(1)),
      shopLat: parseFloat(r.shop_lat),
      shopLng: parseFloat(r.shop_lng),
    })),
  });
}
