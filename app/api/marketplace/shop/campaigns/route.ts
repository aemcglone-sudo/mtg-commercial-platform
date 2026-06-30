import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface ShopRow { id: string }
interface CampaignRow {
  id: string; type: string; title: string; body: string; cta_text: string; cta_url: string;
  target_type: string; radius_miles: string; scryfall_ids: string[]; discount_percent: string;
  valid_until: string; status: string; scheduled_for: string; sent_at: string;
  recipients_count: string; created_at: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<ShopRow>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ campaigns: [] });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  const rows = await findMany<CampaignRow>(
    `SELECT id, type, title, body, cta_text, cta_url, target_type, radius_miles::text,
            scryfall_ids, discount_percent::text, valid_until::text, status,
            scheduled_for::text, sent_at::text, recipients_count::text, created_at::text
     FROM shop_campaigns
     WHERE shop_id = ? ${status ? 'AND status = ?' : ''}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    status ? [shop.id, status, limit, offset] : [shop.id, limit, offset]
  );

  return NextResponse.json({ campaigns: rows, page });
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<ShopRow>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as {
    type: string; title: string; body: string; ctaText?: string; ctaUrl?: string;
    targetType?: string; radiusMiles?: number; scryfallIds?: string[];
    discountPercent?: number; validUntil?: string; scheduledFor?: string;
  };

  if (!body.type || !body.title || !body.body) {
    return NextResponse.json({ error: 'type, title, and body required' }, { status: 400 });
  }

  const id = randomUUID();
  await run(
    `INSERT INTO shop_campaigns
       (id, shop_id, type, title, body, cta_text, cta_url, target_type, radius_miles,
        scryfall_ids, discount_percent, valid_until, scheduled_for, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, shop.id, body.type, body.title, body.body,
      body.ctaText ?? null, body.ctaUrl ?? null,
      body.targetType ?? 'matching_watchlist',
      body.radiusMiles ?? 50,
      body.scryfallIds ?? [],
      body.discountPercent ?? null,
      body.validUntil ?? null,
      body.scheduledFor ?? null,
      'draft',
    ]
  );

  return NextResponse.json({ ok: true, campaignId: id });
}
