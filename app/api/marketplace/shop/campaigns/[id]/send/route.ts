import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany, run } from '@/lib/db';
import { createNotification } from '@/lib/marketplace/notify';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface ShopRow { id: string; name: string }
interface CampaignRow {
  id: string; type: string; title: string; body: string; cta_text: string; cta_url: string;
  target_type: string; radius_miles: string; scryfall_ids: string[]; status: string;
  week_number: string; week_year: string;
}
interface RateLimitRow { count: string }
interface RecipientRow { user_id: string; campaign_notifications: boolean; opted_out_shops: string[] }

function isoWeek(d: Date): { week: number; year: number } {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
    year: tmp.getUTCFullYear(),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<ShopRow>(`SELECT id, name FROM shops WHERE user_id = ?`, [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { id } = await params;
  const campaign = await findOne<CampaignRow>(
    `SELECT id, type, title, body, cta_text, cta_url, target_type, radius_miles::text,
            scryfall_ids, status, week_number::text, week_year::text
     FROM shop_campaigns WHERE id = ? AND shop_id = ?`,
    [id, shop.id]
  );

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!['draft', 'scheduled'].includes(campaign.status)) {
    return NextResponse.json({ error: 'Campaign already sent or cancelled' }, { status: 422 });
  }

  // Rate limit check: 3 campaigns per week
  const { week, year } = isoWeek(new Date());
  const prefs = await findOne<{ campaigns_per_week: string }>(
    `SELECT COALESCE(campaigns_per_week, 3)::text AS campaigns_per_week
     FROM shop_notification_prefs WHERE shop_id = ?`,
    [shop.id]
  );
  const limit = parseInt(prefs?.campaigns_per_week ?? '3');

  const used = await findOne<RateLimitRow>(
    `SELECT COUNT(*)::text AS count FROM shop_campaigns
     WHERE shop_id = ? AND status = 'sent' AND week_number = ? AND week_year = ?`,
    [shop.id, week, year]
  );
  if (parseInt(used?.count ?? '0') >= limit) {
    return NextResponse.json({ error: 'Weekly campaign limit reached' }, { status: 422 });
  }

  // Find recipients
  let recipients: RecipientRow[] = [];

  if (campaign.target_type === 'matching_watchlist' && campaign.scryfall_ids.length > 0) {
    recipients = await findMany<RecipientRow>(
      `SELECT DISTINCT cw.user_id,
              COALESCE(cnp.campaign_notifications, true) AS campaign_notifications,
              COALESCE(cnp.opted_out_shops, '{}') AS opted_out_shops
       FROM collector_card_watchlist cw
       LEFT JOIN collector_notification_prefs cnp ON cnp.user_id = cw.user_id
       WHERE cw.scryfall_id = ANY(?) AND cw.active = true`,
      [campaign.scryfall_ids]
    );
  } else if (campaign.target_type === 'radius') {
    recipients = await findMany<RecipientRow>(
      `SELECT DISTINCT cnp.user_id,
              cnp.campaign_notifications,
              COALESCE(cnp.opted_out_shops, '{}') AS opted_out_shops
       FROM collector_notification_prefs cnp
       JOIN shops s ON s.id = ?
       WHERE cnp.lat IS NOT NULL AND cnp.lng IS NOT NULL
         AND (
           3959 * acos(
             LEAST(1.0, cos(radians(cnp.lat::float)) * cos(radians(s.lat::float)) *
             cos(radians(s.lng::float) - radians(cnp.lng::float)) +
             sin(radians(cnp.lat::float)) * sin(radians(s.lat::float)))
           )
         ) <= ?`,
      [shop.id, parseInt(campaign.radius_miles)]
    );
  }

  // Filter opted-out
  const eligible = recipients.filter(r =>
    r.campaign_notifications && !r.opted_out_shops.includes(shop.id)
  );

  // Deliver notifications
  for (const r of eligible) {
    await createNotification(r.user_id, `campaign_${campaign.type}`, {
      title: campaign.title,
      body: campaign.body,
      campaignId: id,
      shopId: shop.id,
      ctaUrl: campaign.cta_url ?? undefined,
    });

    await run(
      `INSERT INTO campaign_deliveries (id, campaign_id, user_id) VALUES (?, ?, ?)
       ON CONFLICT (campaign_id, user_id) DO NOTHING`,
      [randomUUID(), id, r.user_id]
    ).catch(() => {});
  }

  await run(
    `UPDATE shop_campaigns
     SET status = 'sent', sent_at = NOW(), recipients_count = ?, week_number = ?, week_year = ?, updated_at = NOW()
     WHERE id = ?`,
    [eligible.length, week, year, id]
  );

  return NextResponse.json({ ok: true, recipientsCount: eligible.length });
}
