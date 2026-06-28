import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string; floorPrices: unknown }>(
    'SELECT id, floor_prices as "floorPrices" FROM shops WHERE "userId" = ?',
    [userId]
  );
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const floors = shop.floorPrices ?? { global: 10, C: 10, U: 25, R: 50, M: 100 };
  return NextResponse.json({ floors });
}

export async function PATCH(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { floors } = await req.json() as { floors: Record<string, number> };
  if (!floors || typeof floors !== 'object') return NextResponse.json({ error: 'Invalid floors' }, { status: 400 });

  await run(
    `UPDATE shops SET floor_prices = ?, "updatedAt" = ? WHERE id = ?`,
    [JSON.stringify(floors), new Date().toISOString(), shop.id]
  );

  return NextResponse.json({ ok: true });
}
