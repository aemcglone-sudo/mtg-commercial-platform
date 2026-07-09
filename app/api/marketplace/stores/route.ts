import { NextRequest, NextResponse } from 'next/server';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website_url: string;
  lat: string | null;
  lng: string | null;
  distance_miles?: string;
  inventory_count: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = parseFloat(searchParams.get('radius') ?? '50');
  const hasLocation = !isNaN(lat) && !isNaN(lng);

  const rows = await findMany<StoreRow>(`
    SELECT
      s.id, s.name, s.slug, s.description,
      s.address, s.city, s.state, s.zip,
      s.phone, s."websiteUrl" AS website_url,
      s.lat::text AS lat, s.lng::text AS lng,
      COUNT(DISTINCT si.id)::text AS inventory_count
      ${hasLocation ? `, (3959 * acos(LEAST(1.0, cos(radians(${lat})) * cos(radians(s.lat::float)) * cos(radians(s.lng::float) - radians(${lng})) + sin(radians(${lat})) * sin(radians(s.lat::float)))))::text AS distance_miles` : ''}
    FROM shops s
    LEFT JOIN shop_inventory si ON si."shopId" = s.id AND si.quantity > 0
    WHERE s.marketplace_active = true AND s."isActive" = true
    ${hasLocation ? `AND s.lat IS NOT NULL AND s.lng IS NOT NULL AND (3959 * acos(LEAST(1.0, cos(radians(${lat})) * cos(radians(s.lat::float)) * cos(radians(s.lng::float) - radians(${lng})) + sin(radians(${lat})) * sin(radians(s.lat::float))))) <= ${radius}` : ''}
    GROUP BY s.id
    ORDER BY ${hasLocation ? 'distance_miles ASC,' : ''} s.name ASC
  `, []);

  return NextResponse.json({
    stores: rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      address: r.address ?? [r.city, r.state, r.zip].filter(Boolean).join(', '),
      phone: r.phone,
      websiteUrl: r.website_url,
      lat: r.lat ? parseFloat(r.lat) : null,
      lng: r.lng ? parseFloat(r.lng) : null,
      inventoryCount: parseInt(r.inventory_count),
      distanceMiles: hasLocation && r.distance_miles ? parseFloat(parseFloat(r.distance_miles).toFixed(1)) : null,
    })),
  });
}
