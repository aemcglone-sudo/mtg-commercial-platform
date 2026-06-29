import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { run } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ scryfallId: string }> }
) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scryfallId } = await params;

  await run(
    `UPDATE collector_card_watchlist
     SET active = false, updated_at = NOW()
     WHERE user_id = ? AND scryfall_id = ? AND source_type = 'manual'`,
    [userId, scryfallId]
  );

  return NextResponse.json({ ok: true });
}
