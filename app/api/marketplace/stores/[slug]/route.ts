import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ShopRow {
  id: string; name: string; slug: string; description: string;
  address: string; city: string; state: string; zip: string;
  phone: string; email: string; website_url: string; logo_url: string; banner_url: string;
  hours: string; specialties: string[]; hold_instructions: string;
  lat: string | null; lng: string | null;
}

interface InventoryRow {
  scryfall_id: string; card_name: string; condition: string;
  foil: boolean; price_cents: string; quantity: string; image_url: string; set_code: string;
}

interface ProductRow {
  id: string; name: string; category: string; image_url: string | null;
  price_cents: string; quantity: string; fulfillment_type: string; notes: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const shop = await findOne<ShopRow>(
    `SELECT id, name, slug, description, address, city, state, zip, phone, email,
            website_url, logo_url, banner_url, hours, specialties, hold_instructions,
            lat::text, lng::text
     FROM shops WHERE slug = ? AND marketplace_active = true AND is_active = true`,
    [slug]
  );
  if (!shop) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const inventory = await findMany<InventoryRow>(
    `SELECT "scryfallId" AS scryfall_id, "cardName" AS card_name, condition, foil,
            "priceCents"::text AS price_cents, quantity::text, "imageUrl" AS image_url, "setCode" AS set_code
     FROM shop_inventory WHERE "shopId" = ? AND quantity > 0
     ORDER BY "cardName" ASC LIMIT 200`,
    [shop.id]
  );

  const products = await findMany<ProductRow>(
    `SELECT sp.id, p.name, p.category, p.image_url,
            sp."priceCents"::text AS price_cents, sp.quantity::text, sp.fulfillment_type, sp.notes
     FROM shop_products sp JOIN mtg_products p ON p.id = sp."productId"
     WHERE sp."shopId" = ? AND sp.is_active = true AND sp.quantity > 0
     ORDER BY p.name ASC`,
    [shop.id]
  );

  return NextResponse.json({
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      description: shop.description,
      address: [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(', '),
      phone: shop.phone,
      email: shop.email,
      websiteUrl: shop.website_url,
      logoUrl: shop.logo_url,
      bannerUrl: shop.banner_url,
      hours: shop.hours,
      specialties: shop.specialties ?? [],
      holdInstructions: shop.hold_instructions,
      lat: shop.lat ? parseFloat(shop.lat) : null,
      lng: shop.lng ? parseFloat(shop.lng) : null,
    },
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      imageUrl: p.image_url,
      priceCents: parseInt(p.price_cents),
      quantity: parseInt(p.quantity),
      fulfillmentType: p.fulfillment_type,
      notes: p.notes,
    })),
    inventory: inventory.map(i => ({
      scryfallId: i.scryfall_id,
      cardName: i.card_name,
      condition: i.condition,
      foil: i.foil,
      priceCents: parseInt(i.price_cents),
      quantity: parseInt(i.quantity),
      imageUrl: i.image_url,
      setCode: i.set_code,
    })),
  });
}
