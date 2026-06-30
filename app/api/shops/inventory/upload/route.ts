import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';
import { parseCardList, prepareText } from '@/lib/card-list-parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
  prices: { usd: string | null; usd_foil: string | null };
  type_line?: string;
  colors?: string[];
  color_identity?: string[];
  cmc?: number;
  rarity?: string;
}

function normName(s: string) {
  return s.toLowerCase().replace(/[''ʼ`´]/g, "'").replace(/[""]/g, '"');
}

async function fetchCollection(identifiers: { name?: string; set?: string }[]) {
  const CHUNK = 75;
  const found: ScryfallCard[] = [];
  const notFound: typeof identifiers = [];
  for (let i = 0; i < identifiers.length; i += CHUNK) {
    const chunk = identifiers.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk }),
      });
      if (res.ok) {
        const data = await res.json() as { data: ScryfallCard[]; not_found: typeof identifiers };
        found.push(...data.data);
        notFound.push(...(data.not_found ?? []));
      } else {
        notFound.push(...chunk);
      }
    } catch {
      notFound.push(...chunk);
    }
    if (i + CHUNK < identifiers.length) await new Promise(r => setTimeout(r, 110));
  }
  return { found, notFound };
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { text, mergeMode } = await req.json() as { text?: string; mergeMode?: 'replace' | 'add' };
  if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 });

  const parsed = parseCardList(prepareText(text));
  if (parsed.length === 0) return NextResponse.json({ error: 'Could not parse any cards' }, { status: 422 });

  // Phase 1: set+name lookup
  const phase1Ids = parsed.map(c => c.set ? { set: c.set, name: c.name } : { name: c.name });
  const { found: p1Found, notFound: p1NotFound } = await fetchCollection(phase1Ids);

  // Phase 2: retry with name-only for unrecognised set codes
  const retryIds = p1NotFound.filter(id => id.set && id.name).map(id => ({ name: id.name! }));
  let p2Found: ScryfallCard[] = [];
  if (retryIds.length > 0) {
    const p2 = await fetchCollection(retryIds);
    p2Found = p2.found;
  }

  const byName = new Map<string, ScryfallCard>();
  for (const card of p2Found) byName.set(normName(card.name), card);
  for (const card of p1Found) byName.set(normName(card.name), card);

  if (mergeMode === 'replace') {
    await run('DELETE FROM shop_inventory WHERE "shopId" = ?', [shop.id]);
  }

  let added = 0;
  let skipped = 0;

  for (const line of parsed) {
    const card = byName.get(normName(line.name));
    if (!card) { skipped++; continue; }

    const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
    const priceCents = card.prices.usd ? Math.round(parseFloat(card.prices.usd) * 100) : 100;

    await run(
      `INSERT INTO shop_inventory
         (id, "shopId", "scryfallId", "cardName", "setCode", "collectorNumber",
          condition, foil, quantity, "priceCents", "imageUrl",
          "typeLine", colors, cmc, rarity, "createdAt", "updatedAt")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())
       ON CONFLICT ("shopId", "scryfallId", condition, foil)
       DO UPDATE SET quantity = shop_inventory.quantity + EXCLUDED.quantity, "updatedAt" = NOW()`,
      [
        randomUUID(), shop.id, card.id, card.name,
        (line.set ?? card.set).toUpperCase(),
        line.collectorNumber ?? card.collector_number,
        'NM', false, line.qty, priceCents, imageUrl,
        card.type_line ?? null,
        JSON.stringify(card.colors ?? card.color_identity ?? []),
        card.cmc ?? null,
        card.rarity ?? null,
      ]
    );
    added++;
  }

  return NextResponse.json({ added, skipped, total: parsed.length });
}
