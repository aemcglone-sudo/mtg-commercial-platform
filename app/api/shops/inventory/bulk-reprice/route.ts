import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { updates } = await req.json() as { updates: { id: string; priceCents: number }[] };
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const now = new Date().toISOString();
  let successCount = 0;

  for (const { id, priceCents } of updates) {
    try {
      await run(
        `UPDATE shop_inventory SET "priceCents" = ?, price_updated_at = ?, "updatedAt" = ?
         WHERE id = ? AND "shopId" = ?`,
        [priceCents, now, now, id, shop.id]
      );
      successCount++;
    } catch {
      // continue on individual errors
    }
  }

  return NextResponse.json({ ok: true, updated: successCount, total: updates.length });
}
