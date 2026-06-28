import { NextRequest, NextResponse } from 'next/server';
import { findMany, findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { fetchTopDecks } from '@/lib/mtgtop8';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

interface Campaign {
  id: string;
  shopId: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  status: string;
  createdAt: string;
}

async function ensureSetReleaseCampaigns(shopId: string): Promise<void> {
  try {
    const res = await fetch('https://api.scryfall.com/sets', {
      headers: { 'User-Agent': 'Grimoire/1.0' },
    });
    if (!res.ok) return;
    const data = await res.json() as { data: Array<{ name: string; code: string; released_at: string; set_type: string }> };
    const now = new Date();
    const soon = new Date(now.getTime() + 21 * 24 * 3600 * 1000);

    for (const set of data.data) {
      if (!['expansion', 'core', 'masters', 'commander'].includes(set.set_type)) continue;
      const releaseDate = new Date(set.released_at);
      if (releaseDate < now || releaseDate > soon) continue;

      // Check if campaign already exists for this set
      const existing = await findOne<{ id: string }>(
        `SELECT id FROM shop_campaigns WHERE "shopId" = ? AND type = 'set_release' AND data::text LIKE ?`,
        [shopId, `%${set.code}%`]
      );
      if (existing) continue;

      const daysUntil = Math.ceil((releaseDate.getTime() - now.getTime()) / (24 * 3600 * 1000));
      await run(
        `INSERT INTO shop_campaigns (id, "shopId", type, title, body, data, status, "createdAt", "updatedAt")
         VALUES (?, ?, 'set_release', ?, ?, ?, 'active', ?, ?)`,
        [
          randomUUID(), shopId,
          `${set.name} releases in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          `${set.name} (${set.code.toUpperCase()}) releases on ${set.released_at}. Consider pricing your singles and promoting your stock.`,
          JSON.stringify({ setCode: set.code, setName: set.name, releaseDate: set.released_at }),
          new Date().toISOString(), new Date().toISOString(),
        ]
      );
    }
  } catch { /* ignore errors */ }
}

async function ensureTrendingDeckCampaigns(shopId: string): Promise<void> {
  try {
    const inventory = await findMany<{ cardName: string }>(
      'SELECT DISTINCT "cardName" FROM shop_inventory WHERE "shopId" = ?',
      [shopId]
    );
    if (inventory.length === 0) return;

    const ownedNames = new Set(inventory.map(r => r.cardName.toLowerCase()));

    // Try to get meta decks (may fail due to network)
    let decks: Awaited<ReturnType<typeof fetchTopDecks>> = [];
    try {
      decks = await fetchTopDecks('Standard');
    } catch { return; }

    for (const deck of decks.slice(0, 10)) {
      const deckCards = [...deck.cards.keys()];
      const matches = deckCards.filter(c => ownedNames.has(c.toLowerCase()));
      const coverage = matches.length / deckCards.length;
      if (coverage < 0.2) continue;

      const existing = await findOne<{ id: string }>(
        `SELECT id FROM shop_campaigns WHERE "shopId" = ? AND type = 'trending_deck' AND title LIKE ?`,
        [shopId, `%${deck.name}%`]
      );
      if (existing) continue;

      await run(
        `INSERT INTO shop_campaigns (id, "shopId", type, title, body, data, status, "createdAt", "updatedAt")
         VALUES (?, ?, 'trending_deck', ?, ?, ?, 'active', ?, ?)`,
        [
          randomUUID(), shopId,
          `You carry ${Math.round(coverage * 100)}% of ${deck.name} (${deck.format})`,
          `You have ${matches.length} of ${deckCards.length} cards in the trending ${deck.name} deck. Cards include: ${matches.slice(0, 5).join(', ')}${matches.length > 5 ? ', and more' : ''}.`,
          JSON.stringify({ deckName: deck.name, format: deck.format, coverage, matchedCards: matches.slice(0, 20) }),
          new Date().toISOString(), new Date().toISOString(),
        ]
      );
    }
  } catch { /* ignore */ }
}

async function ensurePriceSpikeCampaigns(shopId: string): Promise<void> {
  try {
    const cutoff48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    const inventory = await findMany<{ scryfallId: string; cardName: string }>(
      'SELECT DISTINCT "scryfallId", "cardName" FROM shop_inventory WHERE "shopId" = ? AND "scryfallId" IS NOT NULL',
      [shopId]
    );
    if (inventory.length === 0) return;

    const ids = inventory.map(r => r.scryfallId);
    const nameMap = new Map(inventory.map(r => [r.scryfallId, r.cardName]));

    const spikes = await findMany<{
      scryfallId: string;
      currentCents: number;
      prevCents: number;
    }>(
      `WITH latest AS (
         SELECT DISTINCT ON ("scryfallId") "scryfallId", "priceCents" as current_cents
         FROM card_price_snapshots
         WHERE "scryfallId" IN (${ids.map(() => '?').join(', ')})
           AND "priceCents" IS NOT NULL
         ORDER BY "scryfallId", "capturedAt" DESC
       ),
       oldest AS (
         SELECT DISTINCT ON ("scryfallId") "scryfallId", "priceCents" as prev_cents
         FROM card_price_snapshots
         WHERE "scryfallId" IN (${ids.map(() => '?').join(', ')})
           AND "capturedAt" >= ?
           AND "priceCents" IS NOT NULL
         ORDER BY "scryfallId", "capturedAt" ASC
       )
       SELECT l."scryfallId", l.current_cents as "currentCents", o.prev_cents as "prevCents"
       FROM latest l
       JOIN oldest o ON o."scryfallId" = l."scryfallId"
       WHERE l.current_cents > o.prev_cents * 1.15`,
      [...ids, ...ids, cutoff48h]
    );

    for (const spike of spikes) {
      const cardName = nameMap.get(spike.scryfallId) ?? 'Unknown Card';
      const delta = ((spike.currentCents - spike.prevCents) / spike.prevCents) * 100;
      const existing = await findOne<{ id: string }>(
        `SELECT id FROM shop_campaigns WHERE "shopId" = ? AND type = 'price_spike'
         AND data::text LIKE ? AND "createdAt" >= ?`,
        [shopId, `%${spike.scryfallId}%`, cutoff48h]
      );
      if (existing) continue;

      await run(
        `INSERT INTO shop_campaigns (id, "shopId", type, title, body, data, status, "createdAt", "updatedAt")
         VALUES (?, ?, 'price_spike', ?, ?, ?, 'active', ?, ?)`,
        [
          randomUUID(), shopId,
          `${cardName} spiked +${delta.toFixed(0)}% in 48h`,
          `${cardName} jumped from $${(spike.prevCents / 100).toFixed(2)} to $${(spike.currentCents / 100).toFixed(2)} (+${delta.toFixed(0)}%). Consider repricing your stock.`,
          JSON.stringify({ scryfallId: spike.scryfallId, cardName, currentCents: spike.currentCents, prevCents: spike.prevCents, delta }),
          new Date().toISOString(), new Date().toISOString(),
        ]
      );
    }
  } catch { /* ignore */ }
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ campaigns: [] });

  const status = req.nextUrl.searchParams.get('status') ?? 'active';

  // Generate campaigns lazily in background (non-blocking)
  Promise.all([
    ensureSetReleaseCampaigns(shopId),
    ensureTrendingDeckCampaigns(shopId),
    ensurePriceSpikeCampaigns(shopId),
  ]).catch(() => {});

  const allCampaigns = await findMany<Campaign>(
    `SELECT * FROM shop_campaigns WHERE "shopId" = ? AND status = ? ORDER BY "createdAt" DESC`,
    [shopId, status]
  );

  // Self-heal: delete any campaigns with null card names from before the bug fix
  const nullIds = allCampaigns.filter(c => c.title.startsWith('null ')).map(c => c.id);
  if (nullIds.length > 0) {
    await run(
      `DELETE FROM shop_campaigns WHERE id IN (${nullIds.map(() => '?').join(', ')})`,
      nullIds
    ).catch(() => {});
  }

  const campaigns = allCampaigns.filter(c => !c.title.startsWith('null '));

  return NextResponse.json({ campaigns });
}
