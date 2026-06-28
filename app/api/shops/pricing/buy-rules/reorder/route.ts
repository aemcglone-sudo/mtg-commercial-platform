import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { ids } = await req.json() as { ids: string[] };
  const now = new Date().toISOString();

  for (let i = 0; i < ids.length; i++) {
    await run(
      'UPDATE shop_buy_rules SET priority = ?, updated_at = ? WHERE id = ? AND shop_id = ?',
      [i + 1, now, ids[i], shop.id]
    );
  }

  return NextResponse.json({ ok: true });
}
