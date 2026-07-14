import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await findMany<{ name: string }>(
    `SELECT DISTINCT name FROM inventory_items WHERE "userId" = ? AND "itemType" = 'cards' ORDER BY name`,
    [userId]
  );

  return NextResponse.json({ names: rows.map(r => r.name) });
}
