import { NextRequest, NextResponse } from 'next/server';
import { findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ShopMatchRow {
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  shop_address: string;
  shop_city: string;
  shop_state: string;
  shop_phone: string;
  hold_instructions: string;
  distance_miles: string;
  scryfall_id: string;
  inventory_id: string;
  condition: string;
  foil: boolean;
  price_cents: string;
  quantity: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cardsParam = searchParams.get('cards') ?? '';
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = Math.min(100, Math.max(5, parseFloat(searchParams.get('radius') ?? '50')));

  if (!cardsParam) return NextResponse.json({ shops: [] });
  if (isNaN(lat) || isNaN(lng)) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  const scryfallIds = cardsParam.split(',').slice(0, 75).map(s => s.trim()).filter(Boolean);
  if (scryfallIds.length === 0) return NextResponse.json({ shops: [] });

  const rows = await findMany<ShopMatchRow>(`
    SELECT
      s.id AS shop_id,
      s.name AS shop_name,
      s.slug AS shop_slug,
      s.address AS shop_address,
      s.city AS shop_city,
      s.state AS shop_state,
      s.phone AS shop_phone,
      s.hold_instructions,
      (
        3959 * acos(
          LEAST(1.0, cos(radians(?)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians(?)) +
          sin(radians(?)) * sin(radians(s.lat::float)))
        )
      )::text AS distance_miles,
      si."scryfallId" AS scryfall_id,
      si.id AS inventory_id,
      si.condition,
      si.foil,
      si."priceCents"::text AS price_cents,
      si.quantity::text
    FROM shop_inventory si
    JOIN shops s ON s.id = si."shopId"
    WHERE si."scryfallId" = ANY(?)
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
  `, [lat, lng, lat, scryfallIds, lat, lng, lat, radius]);

  // Group by shop
  const shopMap = new Map<string, {
    shopId: string; shopName: string; shopSlug: string;
    address: string; phone: string; holdInstructions: string;
    distanceMiles: number;
    cardsAvailable: Array<{ scryfallId: string; inventoryId: string; condition: string; foil: boolean; priceCents: number; quantity: number }>;
  }>();

  for (const row of rows) {
    if (!shopMap.has(row.shop_id)) {
      shopMap.set(row.shop_id, {
        shopId: row.shop_id,
        shopName: row.shop_name,
        shopSlug: row.shop_slug,
        address: [row.shop_address, row.shop_city, row.shop_state].filter(Boolean).join(', '),
        phone: row.shop_phone,
        holdInstructions: row.hold_instructions,
        distanceMiles: parseFloat(parseFloat(row.distance_miles).toFixed(1)),
        cardsAvailable: [],
      });
    }
    shopMap.get(row.shop_id)!.cardsAvailable.push({
      scryfallId: row.scryfall_id,
      inventoryId: row.inventory_id,
      condition: row.condition,
      foil: row.foil,
      priceCents: parseInt(row.price_cents),
      quantity: parseInt(row.quantity),
    });
  }

  const requestedSet = new Set(scryfallIds);
  const shops = Array.from(shopMap.values()).map(shop => ({
    ...shop,
    cardsNotAvailable: scryfallIds.filter(id => !shop.cardsAvailable.some(c => c.scryfallId === id)),
  }));

  // Sort: most cards available first, then by distance
  shops.sort((a, b) => {
    const diff = b.cardsAvailable.length - a.cardsAvailable.length;
    return diff !== 0 ? diff : a.distanceMiles - b.distanceMiles;
  });

  void requestedSet;
  return NextResponse.json({ shops });
}
