import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ShopRow {
  id: string; name: string; slug: string;
  site_status: string; template: string;
  theme_primary_hex: string; theme_accent_hex: string; font_pairing: string;
  about_text: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  phone: string | null; email: string | null; website_url: string | null;
  logo_url: string | null; banner_url: string | null;
  hours: string | null; specialties: string[] | null; social_links: string;
  lat: string | null; lng: string | null;
}

interface SectionRow {
  id: string; section_type: string; visible: boolean; sort_order: number; config: string;
}

interface InventoryRow {
  id: string; scryfall_id: string; card_name: string; condition: string;
  foil: boolean; price_cents: string; quantity: string; image_url: string | null;
}

interface EventRow {
  id: string; title: string; description: string | null; event_type: string | null;
  starts_at: string; ends_at: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const shop = await findOne<ShopRow>(
    `SELECT id, name, slug, site_status, template,
            theme_primary_hex, theme_accent_hex, font_pairing, about_text,
            address, city, state, zip, phone, email,
            "websiteUrl" AS website_url, "logoUrl" AS logo_url, "bannerUrl" AS banner_url,
            hours::text, specialties, social_links::text,
            lat::text, lng::text
     FROM shops WHERE slug = ? AND "isActive" = true`,
    [slug]
  );
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sections = await findMany<SectionRow>(
    `SELECT id, section_type, visible, sort_order, config::text AS config
     FROM shop_site_sections WHERE shop_id = ? ORDER BY sort_order ASC`,
    [shop.id]
  );

  const inventorySection = sections.find(s => s.section_type === 'inventory');
  const config = inventorySection ? JSON.parse(inventorySection.config || '{}') : {};
  const limit = config.inventory_display_limit ?? 24;

  const inventory = await findMany<InventoryRow>(
    `SELECT id, "scryfallId" AS scryfall_id, "cardName" AS card_name, condition, foil,
            "priceCents"::text AS price_cents, quantity::text, "imageUrl" AS image_url
     FROM shop_inventory WHERE "shopId" = ? AND quantity > 0
     ORDER BY "priceCents" DESC LIMIT ?`,
    [shop.id, limit]
  );

  const events = await findMany<EventRow>(
    `SELECT id, title, description, event_type, starts_at::text, ends_at::text
     FROM shop_events WHERE shop_id = ? AND starts_at >= NOW()
     ORDER BY starts_at ASC`,
    [shop.id]
  );

  return NextResponse.json({
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      siteStatus: shop.site_status,
      template: shop.template,
      themePrimaryHex: shop.theme_primary_hex,
      themeAccentHex: shop.theme_accent_hex,
      fontPairing: shop.font_pairing,
      aboutText: shop.about_text,
      address: shop.address ?? [shop.city, shop.state, shop.zip].filter(Boolean).join(', '),
      phone: shop.phone,
      email: shop.email,
      websiteUrl: shop.website_url,
      logoUrl: shop.logo_url,
      bannerUrl: shop.banner_url,
      hours: shop.hours ? JSON.parse(shop.hours) : null,
      specialties: shop.specialties ?? [],
      socialLinks: shop.social_links ? JSON.parse(shop.social_links) : {},
      lat: shop.lat ? parseFloat(shop.lat) : null,
      lng: shop.lng ? parseFloat(shop.lng) : null,
    },
    sections: sections.map(s => ({
      id: s.id,
      type: s.section_type,
      visible: s.visible,
      sortOrder: s.sort_order,
      config: JSON.parse(s.config || '{}'),
    })),
    inventory: inventory.map(i => ({
      id: i.id,
      scryfallId: i.scryfall_id,
      cardName: i.card_name,
      condition: i.condition,
      foil: i.foil,
      priceCents: parseInt(i.price_cents),
      quantity: parseInt(i.quantity),
      imageUrl: i.image_url ?? (i.scryfall_id
        ? `https://cards.scryfall.io/normal/front/${i.scryfall_id[0]}/${i.scryfall_id[1]}/${i.scryfall_id}.jpg`
        : null),
    })),
    events: events.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      eventType: e.event_type,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
    })),
  });
}
