import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.userId) return NextResponse.json({ stores: [] });

  const rows = await findMany<{
    id: string; name: string; slug: string; address: string;
    website_url: string; lat: string | null; lng: string | null; inventory_count: string;
  }>(`
    SELECT s.id, s.name, s.slug, s.address,
           s."websiteUrl" AS website_url,
           s.lat::text AS lat, s.lng::text AS lng,
           COUNT(DISTINCT si.id)::text AS inventory_count
    FROM collector_favorite_shops f
    JOIN shops s ON s.id = f."shopId"
    LEFT JOIN shop_inventory si ON si."shopId" = s.id AND si.quantity > 0
    WHERE f."userId" = ? AND s."isActive" = true
    GROUP BY s.id
    ORDER BY s.name ASC
  `, [session.userId]);

  return NextResponse.json({
    stores: rows.map(r => ({
      id: r.id, name: r.name, slug: r.slug,
      address: r.address,
      websiteUrl: r.website_url,
      lat: r.lat ? parseFloat(r.lat) : null,
      lng: r.lng ? parseFloat(r.lng) : null,
      inventoryCount: parseInt(r.inventory_count),
    })),
  });
}
