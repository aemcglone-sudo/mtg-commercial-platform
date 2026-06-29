import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface WatchlistRow {
  id: string;
  scryfall_id: string;
  card_name: string;
  source_type: string;
  source_id: string;
  max_price_cents: string;
  condition_floor: string;
  last_notified_at: string;
  active: boolean;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await findMany<WatchlistRow>(
    `SELECT id, scryfall_id, card_name, source_type, source_id,
            max_price_cents::text, condition_floor, last_notified_at, active, created_at
     FROM collector_card_watchlist
     WHERE user_id = ? AND active = true
     ORDER BY created_at DESC`,
    [userId]
  );

  return NextResponse.json({ watchlist: rows });
}

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    scryfallId: string;
    cardName: string;
    maxPriceCents?: number;
    conditionFloor?: string;
  };

  if (!body.scryfallId || !body.cardName) {
    return NextResponse.json({ error: 'scryfallId and cardName required' }, { status: 400 });
  }

  await run(
    `INSERT INTO collector_card_watchlist
       (id, user_id, scryfall_id, card_name, source_type, max_price_cents, condition_floor)
     VALUES (?, ?, ?, ?, 'manual', ?, ?)
     ON CONFLICT (user_id, scryfall_id, source_type, COALESCE(source_id, ''))
     DO UPDATE SET active = true, updated_at = NOW()`,
    [
      randomUUID(), userId, body.scryfallId, body.cardName,
      body.maxPriceCents ?? null,
      body.conditionFloor ?? 'HP',
    ]
  );

  return NextResponse.json({ ok: true });
}
