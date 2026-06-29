import { NextRequest, NextResponse } from 'next/server';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface AvailabilityRow {
  scryfall_id: string;
  store_count: string;
  lowest_price_cents: string;
  shop_id: string;
  shop_name: string;
  distance_miles: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cardsParam = searchParams.get('cards') ?? '';
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = Math.min(100, Math.max(5, parseFloat(searchParams.get('radius') ?? '50')));

  if (!cardsParam) return NextResponse.json({});
  if (isNaN(lat) || isNaN(lng)) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const scryfallIds = cardsParam.split(',').slice(0, 100).map(s => s.trim()).filter(Boolean);
  if (scryfallIds.length === 0) return NextResponse.json({});

  const rows = await findMany<AvailabilityRow>(`
    SELECT
      si.scryfall_id,
      COUNT(DISTINCT si.shop_id)::text AS store_count,
      MIN(si.price_cents)::text AS lowest_price_cents,
      MIN(si.shop_id) AS shop_id,
      MIN(s.name) AS shop_name,
      MIN(
        3959 * acos(
          LEAST(1.0, cos(radians($1)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians($2)) +
          sin(radians($1)) * sin(radians(s.lat::float)))
        )
      )::text AS distance_miles
    FROM shop_inventory si
    JOIN shops s ON s.id = si.shop_id
    WHERE si.scryfall_id = ANY($3)
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
    GROUP BY si.scryfall_id
  `, [lat, lng, scryfallIds, radius]);

  const result: Record<string, { available: boolean; store_count: number; lowest_price_cents: number }> = {};
  for (const id of scryfallIds) {
    result[id] = { available: false, store_count: 0, lowest_price_cents: 0 };
  }
  for (const row of rows) {
    result[row.scryfall_id] = {
      available: true,
      store_count: parseInt(row.store_count),
      lowest_price_cents: parseInt(row.lowest_price_cents),
    };
  }

  return NextResponse.json(result);
}
