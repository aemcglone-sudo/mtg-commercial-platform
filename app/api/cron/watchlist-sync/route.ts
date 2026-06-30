import { NextRequest, NextResponse } from 'next/server';
import { findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

function checkCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

interface DeckMissingRow {
  user_id: string;
  deck_id: string;
  scryfall_id: string;
  card_name: string;
}

export async function GET(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Decks store cards as a JSON string: { "Card Name": quantity }
  // Missing cards are those not in the user's collection
  // For now, sync all cards in all decks into the watchlist as deck_missing entries
  const decks = await findMany<{ user_id: string; id: string; cards: string }>(
    `SELECT "userId" AS user_id, id, cards FROM decks WHERE cards IS NOT NULL AND cards != '{}'`,
    []
  );

  let upserted = 0;
  let deactivated = 0;

  for (const deck of decks) {
    let cardMap: Record<string, number> = {};
    try { cardMap = JSON.parse(deck.cards); } catch { continue; }

    const cardNames = Object.keys(cardMap);
    if (cardNames.length === 0) continue;

    // Resolve scryfall IDs from shop_inventory (best effort — card_name match)
    const resolved = await findMany<{ card_name: string; scryfall_id: string }>(
      `SELECT DISTINCT "cardName" AS card_name, "scryfallId" AS scryfall_id FROM shop_inventory WHERE "cardName" = ANY(?)`,
      [cardNames]
    );

    const nameToId = new Map(resolved.map(r => [r.card_name, r.scryfall_id]));

    for (const cardName of cardNames) {
      const scryfallId = nameToId.get(cardName);
      if (!scryfallId) continue;

      await run(
        `INSERT INTO collector_card_watchlist
           (id, user_id, scryfall_id, card_name, source_type, source_id)
         VALUES (?, ?, ?, ?, 'deck_missing', ?)
         ON CONFLICT (user_id, scryfall_id, source_type, COALESCE(source_id, ''))
         DO UPDATE SET active = true, updated_at = NOW()`,
        [randomUUID(), deck.user_id, scryfallId, cardName, deck.id]
      ).catch(() => {});
      upserted++;
    }
  }

  // Deactivate watchlist entries for deleted decks
  const result = await run(
    `UPDATE collector_card_watchlist cw
     SET active = false, updated_at = NOW()
     WHERE cw.source_type = 'deck_missing'
       AND cw.source_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM decks d WHERE d.id = cw.source_id)
       AND cw.active = true`,
    []
  );

  deactivated = result?.rowCount ?? 0;

  return NextResponse.json({ upserted, deactivated });
}

