import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string; name: string; category: string; product_type: string;
  set_name: string | null; msrp_cents: number | null; image_url: string | null;
}

interface ShopListingRow {
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  shop_lat: string;
  shop_lng: string;
  distance_miles: string;
  price_cents: string;
  quantity: number;
  fulfillment_type: string;
  notes: string | null;
  listing_id: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = parseFloat(searchParams.get('radius') ?? '50');

  const product = await findOne<ProductRow>(
    `SELECT id, name, category, product_type, set_name, msrp_cents, image_url
     FROM mtg_products WHERE id = ? AND is_active = true`,
    [id]
  );
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ product, shops: [] });
  }

  const shops = await findMany<ShopListingRow>(
    `SELECT
       s.id AS shop_id, s.name AS shop_name, s.slug AS shop_slug,
       s.lat::text AS shop_lat, s.lng::text AS shop_lng,
       (
         3959 * acos(
           cos(radians(?)) * cos(radians(s.lat::float)) *
           cos(radians(s.lng::float) - radians(?)) +
           sin(radians(?)) * sin(radians(s.lat::float))
         )
       )::text AS distance_miles,
       sp."priceCents"::text AS price_cents,
       sp.quantity,
       sp.fulfillment_type,
       sp.notes,
       sp.id AS listing_id
     FROM shop_products sp
     JOIN shops s ON s.id = sp."shopId"
     WHERE sp."productId" = ?
       AND sp.is_active = true
       AND sp.quantity > 0
       AND s.lat IS NOT NULL AND s.lng IS NOT NULL
       AND s.marketplace_active = true
       AND (
         3959 * acos(
           cos(radians(?)) * cos(radians(s.lat::float)) *
           cos(radians(s.lng::float) - radians(?)) +
           sin(radians(?)) * sin(radians(s.lat::float))
         )
       ) <= ?
     ORDER BY distance_miles ASC, sp."priceCents" ASC`,
    [lat, lng, lat, id, lat, lng, lat, radius]
  );

  return NextResponse.json({
    product,
    shops: shops.map(s => ({
      shopId: s.shop_id,
      shopName: s.shop_name,
      shopSlug: s.shop_slug,
      distanceMiles: parseFloat(parseFloat(s.distance_miles).toFixed(1)),
      priceCents: parseInt(s.price_cents),
      quantity: s.quantity,
      fulfillmentType: s.fulfillment_type,
      notes: s.notes,
      listingId: s.listing_id,
    })),
  });
}
