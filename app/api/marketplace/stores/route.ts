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

export async function GET(_req: NextRequest) {
  const rows = await findMany<StoreRow>(`
    SELECT
      s.id, s.name, s.slug, s.description,
      s.address, s.city, s.state, s.zip,
      s.phone, s.website_url,
      COUNT(DISTINCT si.id)::text AS inventory_count
    FROM shops s
    LEFT JOIN shop_inventory si ON si."shopId" = s.id AND si.quantity > 0
    WHERE s.marketplace_active = true AND s.is_active = true
    GROUP BY s.id
    ORDER BY s.name ASC
  `, []);

  return NextResponse.json({
    stores: rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      address: [r.address, r.city, r.state, r.zip].filter(Boolean).join(', '),
      phone: r.phone,
      websiteUrl: r.website_url,
      inventoryCount: parseInt(r.inventory_count),
    })),
  });
}
