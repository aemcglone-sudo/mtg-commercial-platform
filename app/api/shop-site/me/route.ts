import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<{ id: string; slug: string; name: string }>(
    `SELECT id, slug, name FROM shops WHERE "userId" = ?`,
    [userId]
  );
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ shopId: shop.id, slug: shop.slug, name: shop.name });
}
