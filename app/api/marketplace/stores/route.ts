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
  email: string;
  website_url: string;
  logo_url: string;
  hours: string;
  specialties: string[];
  hold_instructions: string;
  distance_miles: string;
  inventory_count: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = Math.min(100, Math.max(5, parseFloat(searchParams.get('radius') ?? '50')));
  const specialty = searchParams.get('specialty');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  const hasLocation = !isNaN(lat) && !isNaN(lng);

  const rows = await findMany<StoreRow>(`
    SELECT
      s.id,
      s.name,
      s.slug,
      s.description,
      s.address,
      s.city,
      s.state,
      s.zip,
      s.phone,
      s.email,
      s.website_url,
      s.logo_url,
      s.hours,
      s.specialties,
      s.hold_instructions,
      ${hasLocation ? `(
        3959 * acos(
          LEAST(1.0, cos(radians($1)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians($2)) +
          sin(radians($1)) * sin(radians(s.lat::float)))
        )
      )::text` : `'0'`} AS distance_miles,
      COUNT(si.id)::text AS inventory_count
    FROM shops s
    LEFT JOIN shop_inventory si ON si.shop_id = s.id AND si.quantity > 0
    WHERE s.marketplace_active = true
      AND s.is_active = true
      ${hasLocation ? `AND s.lat IS NOT NULL AND s.lng IS NOT NULL AND (
        3959 * acos(
          LEAST(1.0, cos(radians($1)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians($2)) +
          sin(radians($1)) * sin(radians(s.lat::float)))
        )
      ) <= $3` : ''}
      ${specialty ? `AND $4 = ANY(s.specialties)` : ''}
    GROUP BY s.id
    ORDER BY ${hasLocation ? 'distance_miles ASC,' : ''} s.name ASC
    LIMIT ${limit} OFFSET ${offset}
  `, hasLocation
    ? (specialty ? [lat, lng, radius, specialty] : [lat, lng, radius])
    : (specialty ? [specialty] : [])
  );

  return NextResponse.json({
    stores: rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      address: [r.address, r.city, r.state, r.zip].filter(Boolean).join(', '),
      phone: r.phone,
      email: r.email,
      websiteUrl: r.website_url,
      logoUrl: r.logo_url,
      hours: r.hours,
      specialties: r.specialties ?? [],
      holdInstructions: r.hold_instructions,
      distanceMiles: hasLocation ? parseFloat(parseFloat(r.distance_miles).toFixed(1)) : null,
      inventoryCount: parseInt(r.inventory_count),
    })),
    page,
  });
}
