import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { id } = await params;
  const existing = await findOne<{ id: string }>(
    'SELECT id FROM shop_campaigns WHERE id = ? AND "shopId" = ?', [id, shop.id]
  );
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await run('UPDATE shop_campaigns SET status = ?, "updatedAt" = ? WHERE id = ?',
    ['dismissed', new Date().toISOString(), id]);

  return NextResponse.json({ ok: true });
}
