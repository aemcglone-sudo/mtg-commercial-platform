import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<{ id: string; lat: string; lng: string }>(
    `SELECT id, lat::text, lng::text FROM shops WHERE user_id = ?`, [userId]
  );
  if (!shop) return NextResponse.json({ estimatedRecipients: 0 });

  const { searchParams } = req.nextUrl;
  const targetType = searchParams.get('target_type') ?? 'matching_watchlist';
  const radiusMiles = parseInt(searchParams.get('radius_miles') ?? '50');
  const scryfallIdsParam = searchParams.get('scryfall_ids') ?? '';
  const scryfallIds = scryfallIdsParam.split(',').filter(Boolean);

  let count = 0;

  if (targetType === 'matching_watchlist' && scryfallIds.length > 0) {
    const row = await findOne<{ count: string }>(
      `SELECT COUNT(DISTINCT cw.user_id)::text AS count
       FROM collector_card_watchlist cw
       LEFT JOIN collector_notification_prefs cnp ON cnp.user_id = cw.user_id
       WHERE cw.scryfall_id = ANY(?)
         AND cw.active = true
         AND COALESCE(cnp.campaign_notifications, true) = true
         AND NOT (? = ANY(COALESCE(cnp.opted_out_shops, '{}')))`,
      [scryfallIds, shop.id]
    );
    count = parseInt(row?.count ?? '0');
  } else if (targetType === 'radius' && shop.lat) {
    const row = await findOne<{ count: string }>(
      `SELECT COUNT(DISTINCT cnp.user_id)::text AS count
       FROM collector_notification_prefs cnp
       WHERE cnp.lat IS NOT NULL AND cnp.lng IS NOT NULL
         AND cnp.campaign_notifications = true
         AND NOT (? = ANY(COALESCE(cnp.opted_out_shops, '{}')))
         AND (
           3959 * acos(
             LEAST(1.0, cos(radians(cnp.lat::float)) * cos(radians($2::float)) *
             cos(radians($3::float) - radians(cnp.lng::float)) +
             sin(radians(cnp.lat::float)) * sin(radians($2::float)))
           )
         ) <= ?`,
      [shop.id, parseFloat(shop.lat), parseFloat(shop.lng ?? '0'), radiusMiles]
    );
    count = parseInt(row?.count ?? '0');
  }

  return NextResponse.json({ estimatedRecipients: count });
}
