import { findOne, findMany } from '@/lib/db';
import type { ShopSite } from '@/components/storefront/types';

interface ShopRow {
  id: string; name: string; slug: string;
  site_status: string; template: string;
  theme_primary_hex: string; theme_accent_hex: string; theme_mode: string; font_pairing: string;
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

interface ProductRow {
  id: string; name: string; category: string; image_url: string | null;
  price_cents: string; quantity: string; notes: string | null;
}

interface EventRow {
  id: string; title: string; description: string | null; event_type: string | null;
  starts_at: string; ends_at: string | null; is_recurring: boolean; recurrence_rule: string | null;
}

interface GalleryRow {
  id: string; image_url: string; thumbnail_url: string; caption: string | null; sort_order: number;
}

export async function getStorefrontData(slug: string): Promise<ShopSite | null> {
  const shop = await findOne<ShopRow>(
    `SELECT id, name, slug, site_status, template,
            theme_primary_hex, theme_accent_hex, theme_mode, font_pairing, about_text,
            address, city, state, zip, phone, email,
            "websiteUrl" AS website_url, "logoUrl" AS logo_url, "bannerUrl" AS banner_url,
            hours::text, specialties, social_links::text,
            lat::text, lng::text
     FROM shops WHERE slug = ? AND "isActive" = true`,
    [slug]
  );
  if (!shop) return null;

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

  const products = await findMany<ProductRow>(
    `SELECT sp.id, p.name, p.category, p.image_url,
            sp."priceCents"::text AS price_cents, sp.quantity::text, sp.notes
     FROM shop_products sp JOIN mtg_products p ON p.id = sp."productId"
     WHERE sp."shopId" = ? AND sp.is_active = true AND sp.quantity > 0
     ORDER BY p.name ASC`,
    [shop.id]
  );

  const events = await findMany<EventRow>(
    `SELECT id, title, description, event_type, starts_at::text, ends_at::text, is_recurring, recurrence_rule
     FROM shop_events WHERE shop_id = ? AND (starts_at >= NOW() OR is_recurring = true)
     ORDER BY starts_at ASC`,
    [shop.id]
  );

  const gallery = await findMany<GalleryRow>(
    `SELECT id, image_url, thumbnail_url, caption, sort_order
     FROM shop_gallery_images WHERE shop_id = ? ORDER BY sort_order ASC`,
    [shop.id]
  );

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      siteStatus: shop.site_status,
      template: shop.template,
      themePrimaryHex: shop.theme_primary_hex,
      themeAccentHex: shop.theme_accent_hex,
      themeMode: shop.theme_mode ?? 'dark',
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
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      imageUrl: p.image_url,
      priceCents: parseInt(p.price_cents),
      quantity: parseInt(p.quantity),
      notes: p.notes,
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
      isRecurring: e.is_recurring,
      recurrenceRule: e.recurrence_rule,
    })),
    gallery: gallery.map(g => ({
      id: g.id,
      imageUrl: g.image_url,
      thumbnailUrl: g.thumbnail_url ?? g.image_url,
      caption: g.caption,
      displayOrder: g.sort_order,
    })),
  };
}
