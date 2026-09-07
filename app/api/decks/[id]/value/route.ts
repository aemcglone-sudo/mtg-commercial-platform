import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { getCachedDeckValue } from '@/lib/deck-value';
import { findOne } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const owned = await findOne<{ id: string }>(`SELECT id FROM decks WHERE id = ? AND "userId" = ?`, [id, userId]);
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { value, computedAt } = await getCachedDeckValue(id);
    return NextResponse.json({ value, computedAt });
  } catch (e) {
    console.error('GET /api/decks/[id]/value failed:', e);
    return NextResponse.json({ error: 'Failed to load deck value' }, { status: 500 });
  }
}
