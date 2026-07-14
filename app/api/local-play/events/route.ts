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
  const daysAhead = Math.min(parseInt(searchParams.get('days_ahead') ?? '14'), 90);
  const eventType = searchParams.get('event_type');
  const format = searchParams.get('format');

  if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const typeFilter = eventType ? `AND le.event_type = ?` : '';
  const formatFilter = format ? `AND le.format ILIKE ?` : '';
  const typeArgs = eventType ? [eventType] : [];
  const formatArgs = format ? [`%${format}%`] : [];

  const events = await findMany<{
    id: string; title: string; event_type: string; format: string | null;
    is_recurring: boolean; day_of_week: string | null; time_of_day: string | null;
    specific_date: string | null; entry_fee: string | null; notes: string | null;
    external_url: string | null; source: string; scrape_confidence: number | null;
    store_name: string; store_address: string | null; store_city: string | null;
    store_id: string; grimoire_shop_id: string | null; discovered_store_id: string | null;
    distance_miles: number;
  }>(
    `SELECT
       le.*,
       COALESCE(ds.name, s.name) AS store_name,
       COALESCE(ds.address, s.address) AS store_address,
       COALESCE(ds.city, s.city) AS store_city,
       COALESCE(ds.id::text, le.grimoire_shop_id) AS store_id,
       (
         3958.8 * acos(
           LEAST(1, cos(radians(?)) * cos(radians(COALESCE(ds.lat, s.lat)::float)) *
           cos(radians(COALESCE(ds.lng, s.lng)::float) - radians(?)) +
           sin(radians(?)) * sin(radians(COALESCE(ds.lat, s.lat)::float)))
         )
       ) AS distance_miles
     FROM local_events le
     LEFT JOIN discovered_stores ds ON ds.id = le.discovered_store_id
     LEFT JOIN shops s ON s.id = le.grimoire_shop_id
     WHERE le.is_active = true
       AND (
         le.is_recurring = true
         OR (le.specific_date >= CURRENT_DATE AND le.specific_date <= CURRENT_DATE + INTERVAL '${daysAhead} days')
       )
       ${typeFilter}
       ${formatFilter}
       AND (
         3958.8 * acos(
           LEAST(1, cos(radians(?)) * cos(radians(COALESCE(ds.lat, s.lat)::float)) *
           cos(radians(COALESCE(ds.lng, s.lng)::float) - radians(?)) +
           sin(radians(?)) * sin(radians(COALESCE(ds.lat, s.lat)::float)))
         )
       ) <= ?
     ORDER BY le.specific_date ASC NULLS LAST, le.day_of_week ASC, le.time_of_day ASC`,
    [lat, lng, lat, ...typeArgs, ...formatArgs, lat, lng, lat, radius]
  );

  return NextResponse.json({ events });
}
