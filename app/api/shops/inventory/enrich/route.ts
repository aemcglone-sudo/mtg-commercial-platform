import { NextRequest, NextResponse } from 'next/server';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

interface ShopRow { id: string }

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shop = await findOne<ShopRow>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { updates } = await req.json() as {
    updates: Array<{ scryfallId: string; typeLine: string; colors: string[]; cmc: number; imageUrl?: string | null }>
  };

  for (const u of updates) {
    await run(
      `UPDATE shop_inventory
       SET "typeLine" = ?, colors = ?, cmc = ?, "imageUrl" = COALESCE("imageUrl", ?)
       WHERE "shopId" = ? AND "scryfallId" = ?`,
      [u.typeLine, JSON.stringify(u.colors), u.cmc, u.imageUrl ?? null, shop.id, u.scryfallId]
    );
  }

  return NextResponse.json({ ok: true, count: updates.length });
}
