import { findMany, run } from '@/lib/db';
import { createNotification, notifyCollector } from './notify';
import { cardAvailableSms } from './sms';

interface ShopItem {
  scryfall_id: string;
  card_name: string;
  condition: string;
  price_cents: number;
}

interface MatchRow {
  user_id: string;
  scryfall_id: string;
  card_name: string;
  condition: string;
  price_cents: string;
  distance_miles: string;
}

interface ShopRow {
  name: string;
  lat: string;
  lng: string;
}

export async function checkAvailabilityAndNotify(
  shopId: string,
  newItems: ShopItem[]
): Promise<void> {
  if (newItems.length === 0) return;

  const shop = await findMany<ShopRow>(`SELECT name, lat::text, lng::text FROM shops WHERE id = ?`, [shopId]);
  if (!shop[0]?.lat) return;

  const scryfallIds = [...new Set(newItems.map(i => i.scryfall_id))];

  const matches = await findMany<MatchRow>(`
    SELECT DISTINCT ON (cw.user_id, cw.scryfall_id)
      cw.user_id,
      cw.scryfall_id,
      cw.card_name,
      si.condition,
      si.price_cents::text,
      (
        3959 * acos(
          LEAST(1.0, cos(radians(cnp.lat::float)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians(cnp.lng::float)) +
          sin(radians(cnp.lat::float)) * sin(radians(s.lat::float)))
        )
      )::text AS distance_miles
    FROM collector_card_watchlist cw
    JOIN collector_notification_prefs cnp ON cnp.user_id = cw.user_id
    JOIN shop_inventory si ON si.scryfall_id = cw.scryfall_id AND si.shop_id = ?
    JOIN shops s ON s.id = si.shop_id
    WHERE cw.scryfall_id = ANY(?)
      AND cw.active = true
      AND si.quantity > 0
      AND cnp.availability_alerts = true
      AND cnp.lat IS NOT NULL AND cnp.lng IS NOT NULL
      AND NOT (? = ANY(COALESCE(cnp.opted_out_shops, '{}')))
      AND (cw.last_notified_at IS NULL
           OR cw.last_notified_at < NOW() - (cw.notify_cooldown_hours || ' hours')::INTERVAL)
      AND (cw.max_price_cents IS NULL OR si.price_cents <= cw.max_price_cents)
      AND (
        3959 * acos(
          LEAST(1.0, cos(radians(cnp.lat::float)) * cos(radians(s.lat::float)) *
          cos(radians(s.lng::float) - radians(cnp.lng::float)) +
          sin(radians(cnp.lat::float)) * sin(radians(s.lat::float)))
        )
      ) <= cnp.search_radius_miles
    ORDER BY cw.user_id, cw.scryfall_id, si.price_cents ASC
  `, [shopId, scryfallIds, shopId]);

  if (matches.length === 0) return;

  // Group by user
  const byUser = new Map<string, MatchRow[]>();
  for (const m of matches) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id)!.push(m);
  }

  const shopName = shop[0].name;

  for (const [userId, userMatches] of byUser) {
    if (userMatches.length === 1) {
      const m = userMatches[0];
      const distance = parseFloat(parseFloat(m.distance_miles).toFixed(1));
      const price = parseInt(m.price_cents);
      await notifyCollector(
        userId,
        'card_available',
        {
          title: `${m.card_name} is available locally`,
          body: `${shopName} has it in ${m.condition} for $${(price / 100).toFixed(2)} · ${distance} miles away`,
          scryfallId: m.scryfall_id,
          shopId,
          ctaUrl: `/marketplace/find?card=${m.scryfall_id}`,
        },
        cardAvailableSms(m.card_name, shopName, m.condition, price, distance)
      );
    } else {
      const names = userMatches.slice(0, 3).map(m => m.card_name).join(', ');
      const extra = userMatches.length > 3 ? ` and ${userMatches.length - 3} more` : '';
      await createNotification(userId, 'card_available_batch', {
        title: `${userMatches.length} cards you need are at ${shopName}`,
        body: names + extra,
        shopId,
        ctaUrl: `/marketplace/find?shop=${shopId}`,
      });
    }

    // Update cooldown timestamps
    const ids = userMatches.map(m => m.scryfall_id);
    await run(
      `UPDATE collector_card_watchlist
       SET last_notified_at = NOW(), updated_at = NOW()
       WHERE user_id = ? AND scryfall_id = ANY(?) AND active = true`,
      [userId, ids]
    ).catch(() => {});
  }
}
