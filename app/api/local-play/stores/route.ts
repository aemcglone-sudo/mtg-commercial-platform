import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') ?? '0');
  const lng = parseFloat(searchParams.get('lng') ?? '0');
  const radius = Math.min(parseInt(searchParams.get('radius') ?? '50'), 100);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const radiusMeters = radius * 1609.34;

  // Haversine distance in miles, union of discovered stores and partner shops
  const stores = await findMany<{
    id: string; name: string; slug: string; address: string | null; city: string | null;
    state: string | null; lat: string; lng: string; phone: string | null;
    website_url: string | null; hours_raw: string | null; hours: unknown;
    is_partner: boolean; grimoire_shop_id: string | null; inventory_count: number;
    upcoming_events_count: number; distance_miles: number;
  }>(
    `SELECT
       ds.id,
       ds.name,
       ds.slug,
       ds.address,
       ds.city,
       ds.state,
       ds.lat,
       ds.lng,
       ds.phone,
       ds.website_url,
       ds.hours_raw,
       ds.hours,
       (ds.grimoire_shop_id IS NOT NULL) AS is_partner,
       ds.grimoire_shop_id,
       COALESCE((
         SELECT COUNT(*) FROM shop_inventory si WHERE si."shopId" = ds.grimoire_shop_id
       ), 0)::int AS inventory_count,
       COALESCE((
         SELECT COUNT(*) FROM local_events le
         WHERE (le.discovered_store_id = ds.id OR le.grimoire_shop_id = ds.grimoire_shop_id)
           AND le.is_active = true
           AND (le.specific_date >= CURRENT_DATE OR le.is_recurring = true)
       ), 0)::int AS upcoming_events_count,
       (
         3958.8 * acos(
           LEAST(1, cos(radians(?)) * cos(radians(ds.lat::float)) *
           cos(radians(ds.lng::float) - radians(?)) +
           sin(radians(?)) * sin(radians(ds.lat::float)))
         )
       ) AS distance_miles
     FROM discovered_stores ds
     WHERE ds.is_active = true
       AND (
         3958.8 * acos(
           LEAST(1, cos(radians(?)) * cos(radians(ds.lat::float)) *
           cos(radians(ds.lng::float) - radians(?)) +
           sin(radians(?)) * sin(radians(ds.lat::float)))
         )
       ) <= ?
     ORDER BY distance_miles ASC
     LIMIT ? OFFSET ?`,
    [lat, lng, lat, lat, lng, lat, radius, limit, offset]
  );

  return NextResponse.json({ stores, page, limit });
}
