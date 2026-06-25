import { NextRequest, NextResponse } from 'next/server';
import { parseCardList, prepareText } from '@/lib/card-list-parser';
import { getRole } from '@/lib/auth';

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
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

interface ScryfallIdentifier {
  name?: string;
  set?: string;
}

export interface ParsedResult {
  found: boolean;
  qty: number;
  name: string;
  scryfallId?: string;
  cardName?: string;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUrl?: string | null;
  marketPriceCents?: number | null;
  priceCents: number;
  condition: string;
  foil: boolean;
  typeLine?: string | null;
  colors?: string[];
  cmc?: number | null;
  rarity?: string | null;
}

// Normalize card names for comparison: lowercase + standardize apostrophes/quotes
function normName(s: string): string {
  return s.toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"');
}

async function fetchCollection(
  identifiers: ScryfallIdentifier[]
): Promise<{ found: ScryfallCard[]; notFound: ScryfallIdentifier[] }> {
  const CHUNK = 75;
  const found: ScryfallCard[] = [];
  const notFound: ScryfallIdentifier[] = [];

  for (let i = 0; i < identifiers.length; i += CHUNK) {
    const chunk = identifiers.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MTGDeckBuilder/1.0 (grimoire-storefront)',
        },
        body: JSON.stringify({ identifiers: chunk }),
      });
      if (res.ok) {
        const data = await res.json() as {
          data: ScryfallCard[];
          not_found: ScryfallIdentifier[];
        };
        found.push(...data.data);
        notFound.push(...(data.not_found ?? []));
      } else {
        notFound.push(...chunk);
      }
    } catch {
      notFound.push(...chunk);
    }
    if (i + CHUNK < identifiers.length) {
      await new Promise(r => setTimeout(r, 110));
    }
  }

  return { found, notFound };
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { text } = await req.json() as { text?: string };
  if (!text?.trim()) return NextResponse.json({ results: [], notFoundCount: 0 });

  const parsed = parseCardList(prepareText(text));
  if (parsed.length === 0) return NextResponse.json({ results: [], notFoundCount: 0 });

  // Phase 1: set+name (MTGA collector numbers differ from paper — don't use collector_number)
  // Cards with an unknown/digital set code go to not_found and get retried below.
  const phase1Ids: ScryfallIdentifier[] = parsed.map(c =>
    c.set ? { set: c.set, name: c.name } : { name: c.name }
  );
  const { found: p1Found, notFound: p1NotFound } = await fetchCollection(phase1Ids);

  // Phase 2: retry set+name failures with name-only (handles unrecognised set codes)
  const retryIds: ScryfallIdentifier[] = p1NotFound
    .filter(id => id.set && id.name) // only ones that had a set — pure name lookups already failed
    .map(id => ({ name: id.name! }));

  let p2Found: ScryfallCard[] = [];
  if (retryIds.length > 0) {
    const p2 = await fetchCollection(retryIds);
    p2Found = p2.found;
  }

  // Build lookup by normalised name. Phase-1 results win over phase-2 (correct printing).
  const byName = new Map<string, ScryfallCard>();
  for (const card of p2Found)  byName.set(normName(card.name), card);
  for (const card of p1Found)  byName.set(normName(card.name), card);

  const results: ParsedResult[] = parsed.map(line => {
    const card = byName.get(normName(line.name));
    if (!card) {
      return { found: false, qty: line.qty, name: line.name, priceCents: 100, condition: 'NM', foil: false };
    }
    const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
    const marketPriceCents = card.prices.usd ? Math.round(parseFloat(card.prices.usd) * 100) : null;
    return {
      found: true,
      qty: line.qty,
      name: line.name,
      scryfallId: card.id,
      cardName: card.name,
      // Keep user's set code from MTGA (for their tracking), fall back to Scryfall's
      setCode: (line.set ?? card.set).toUpperCase(),
      setName: card.set_name,
      collectorNumber: line.collectorNumber ?? card.collector_number,
      imageUrl,
      marketPriceCents,
      priceCents: marketPriceCents ?? 100,
      condition: 'NM',
      foil: false,
      typeLine: card.type_line ?? null,
      colors: card.colors ?? card.color_identity ?? [],
      cmc: card.cmc ?? null,
      rarity: card.rarity ?? null,
    };
  });

  const notFoundCount = results.filter(r => !r.found).length;
  return NextResponse.json({ results, notFoundCount });
}
