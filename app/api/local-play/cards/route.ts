import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim();
  const lat = parseFloat(searchParams.get('lat') ?? '0');
  const lng = parseFloat(searchParams.get('lng') ?? '0');
  const radius = Math.min(parseInt(searchParams.get('radius') ?? '50'), 100);

  if (!q) return NextResponse.json({ results: [] });
  if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const results = await findMany<{
    card_name: string; scryfall_id: string; condition: string | null;
    price_cents: number | null; quantity: number;
    shop_id: string; shop_name: string; shop_address: string | null;
    shop_city: string | null; shop_slug: string;
    distance_miles: number;
  }>(
    `SELECT
       si."cardName" AS card_name,
       si."scryfallId" AS scryfall_id,
       si.condition,
       si."priceCents" AS price_cents,
       si.quantity,
       s.id AS shop_id,
       s.name AS shop_name,
       s.address AS shop_address,
       s.city AS shop_city,
       s.slug AS shop_slug,
       (
         3958.8 * acos(
           LEAST(1, cos(radians(?)) * cos(radians(s.lat::float)) *
           cos(radians(s.lng::float) - radians(?)) +
           sin(radians(?)) * sin(radians(s.lat::float)))
         )
       ) AS distance_miles
     FROM shop_inventory si
     JOIN shops s ON s.id = si."shopId"
     WHERE si."cardName" ILIKE ?
       AND si.quantity > 0
       AND s.lat IS NOT NULL AND s.lng IS NOT NULL
       AND (
         3958.8 * acos(
           LEAST(1, cos(radians(?)) * cos(radians(s.lat::float)) *
           cos(radians(s.lng::float) - radians(?)) +
           sin(radians(?)) * sin(radians(s.lat::float)))
         )
       ) <= ?
     ORDER BY distance_miles ASC, si."priceCents" ASC
     LIMIT 50`,
    [lat, lng, lat, `%${q}%`, lat, lng, lat, radius]
  );

  return NextResponse.json({ results });
}
