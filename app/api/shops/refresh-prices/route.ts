import { NextRequest, NextResponse } from 'next/server';
import { findMany, findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { randomUUID } from 'crypto';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

interface ScryfallCard {
  id: string;
  name: string;
  prices: { usd: string | null; usd_foil: string | null };
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 404 });

  // Get unique scryfallIds from inventory
  const rows = await findMany<{ scryfallId: string; cardName: string }>(
    'SELECT DISTINCT "scryfallId", "cardName" FROM shop_inventory WHERE "shopId" = ? AND "scryfallId" IS NOT NULL',
    [shopId]
  );
  if (rows.length === 0) return NextResponse.json({ refreshed: 0 });

  const nameMap = new Map(rows.map(r => [r.scryfallId, r.cardName]));
  const ids = [...nameMap.keys()];
  const now = new Date().toISOString();
  let refreshed = 0;

  const CHUNK = 75;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk.map(id => ({ id })) }),
      });
      if (res.ok) {
        const data = await res.json() as { data: ScryfallCard[] };
        for (const card of data.data) {
          const priceCents = card.prices.usd ? Math.round(parseFloat(card.prices.usd) * 100) : null;
          const foilPriceCents = card.prices.usd_foil ? Math.round(parseFloat(card.prices.usd_foil) * 100) : null;
          await run(
            `INSERT INTO card_price_snapshots (id, "scryfallId", "cardName", "priceCents", "foilPriceCents", "capturedAt")
             VALUES (?, ?, ?, ?, ?, ?)`,
            [randomUUID(), card.id, nameMap.get(card.id) ?? card.name, priceCents, foilPriceCents, now]
          );
          refreshed++;
        }
      }
    } catch { /* ignore chunk errors */ }
    if (i + CHUNK < ids.length) await new Promise(r => setTimeout(r, 110));
  }

  return NextResponse.json({ refreshed });
}
