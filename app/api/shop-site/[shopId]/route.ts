import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function resolveShop(req: NextRequest, shopId: string) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return null;
  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE id = ? AND "userId" = ?`, [shopId, userId]);
  return shop ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await resolveShop(req, shopId);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const row = await findOne<{
    site_status: string; template: string;
    theme_primary_hex: string; theme_accent_hex: string; theme_mode: string; font_pairing: string;
    about_text: string | null; published_at: string | null;
    hours: string | null; social_links: string; slug: string; name: string;
    banner_url: string | null;
  }>(
    `SELECT site_status, template, theme_primary_hex, theme_accent_hex, theme_mode, font_pairing,
            about_text, published_at::text, hours::text, social_links::text, slug, name,
            "bannerUrl" AS banner_url
     FROM shops WHERE id = ?`,
    [shopId]
  );
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let sections = await findMany<{ id: string; section_type: string; visible: boolean; sort_order: number; config: string }>(
    `SELECT id, section_type, visible, sort_order, config::text AS config
     FROM shop_site_sections WHERE shop_id = ? ORDER BY sort_order ASC`,
    [shopId]
  );

  // Auto-initialize default sections for shops that have never visited the site builder
  if (sections.length === 0) {
    const defaults = [
      { type: 'hero',           visible: true,  order: 0 },
      { type: 'about',          visible: true,  order: 1 },
      { type: 'hours_location', visible: true,  order: 2 },
      { type: 'inventory',      visible: true,  order: 3 },
      { type: 'gallery',        visible: false, order: 4 },
      { type: 'events',         visible: false, order: 5 },
      { type: 'buylist',        visible: false, order: 6 },
      { type: 'social',         visible: true,  order: 7 },
      { type: 'contact',        visible: false, order: 8 },
    ];
    for (const d of defaults) {
      await run(
        `INSERT INTO shop_site_sections (id, shop_id, section_type, visible, sort_order, config)
         VALUES (gen_random_uuid(), ?, ?, ?, ?, '{}')
         ON CONFLICT (shop_id, section_type) DO NOTHING`,
        [shopId, d.type, d.visible, d.order]
      );
    }
    sections = await findMany<{ id: string; section_type: string; visible: boolean; sort_order: number; config: string }>(
      `SELECT id, section_type, visible, sort_order, config::text AS config
       FROM shop_site_sections WHERE shop_id = ? ORDER BY sort_order ASC`,
      [shopId]
    );
  }

  return NextResponse.json({
    siteStatus: row.site_status,
    template: row.template,
    themePrimaryHex: row.theme_primary_hex,
    themeAccentHex: row.theme_accent_hex,
    themeMode: row.theme_mode ?? 'dark',
    fontPairing: row.font_pairing,
    aboutText: row.about_text,
    publishedAt: row.published_at,
    hours: row.hours ? JSON.parse(row.hours) : {},
    socialLinks: row.social_links ? JSON.parse(row.social_links) : {},
    slug: row.slug,
    name: row.name,
    bannerUrl: row.banner_url,
    sections: sections.map(s => ({
      id: s.id,
      type: s.section_type,
      visible: s.visible,
      sortOrder: s.sort_order,
      config: JSON.parse(s.config || '{}'),
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await resolveShop(req, shopId);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    aboutText?: string;
    hours?: Record<string, string>;
    socialLinks?: Record<string, string>;
    themePrimaryHex?: string;
    themeAccentHex?: string;
    themeMode?: string;
    template?: string;
  };

  await run(
    `UPDATE shops SET
       about_text          = COALESCE(?, about_text),
       hours               = COALESCE(?::jsonb, hours),
       social_links        = COALESCE(?::jsonb, social_links),
       theme_primary_hex   = COALESCE(?, theme_primary_hex),
       theme_accent_hex    = COALESCE(?, theme_accent_hex),
       theme_mode          = COALESCE(?, theme_mode),
       template            = COALESCE(?, template)
     WHERE id = ?`,
    [
      body.aboutText ?? null,
      body.hours != null ? JSON.stringify(body.hours) : null,
      body.socialLinks != null ? JSON.stringify(body.socialLinks) : null,
      body.themePrimaryHex ?? null,
      body.themeAccentHex ?? null,
      body.themeMode ?? null,
      body.template ?? null,
      shopId,
    ]
  );

  return NextResponse.json({ ok: true });
}
