import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getShopId(req: NextRequest): Promise<string | null> {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'shop_owner') return null;
  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  return shop?.id ?? null;
}

export async function PATCH(req: NextRequest) {
  const shopId = await getShopId(req);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { updates: { id: string; displayOrder: number }[] };

  for (const { id, displayOrder } of body.updates) {
    await run(
      `UPDATE shop_gallery_images SET sort_order = ?, updated_at = NOW()
       WHERE id = ? AND shop_id = ?`,
      [displayOrder, id, shopId]
    );
  }

  return NextResponse.json({ ok: true });
}
