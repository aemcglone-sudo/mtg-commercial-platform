import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { DEFAULT_BUY_MATRIX, DEFAULT_MARGIN_TARGETS } from '@/lib/buy-pricing';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const shop = await findOne<{ buy_matrix: unknown; margin_targets: unknown }>(
    'SELECT buy_matrix, margin_targets FROM shops WHERE id = ?',
    [shopId]
  );

  return NextResponse.json({
    buyMatrix: shop?.buy_matrix ?? DEFAULT_BUY_MATRIX,
    marginTargets: shop?.margin_targets ?? DEFAULT_MARGIN_TARGETS,
  });
}

export async function PATCH(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as { buyMatrix?: unknown; marginTargets?: unknown };
  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (body.buyMatrix !== undefined) {
    updates.push('buy_matrix = ?');
    values.push(JSON.stringify(body.buyMatrix));
  }
  if (body.marginTargets !== undefined) {
    updates.push('margin_targets = ?');
    values.push(JSON.stringify(body.marginTargets));
  }
  if (updates.length === 0) return NextResponse.json({ ok: true });

  values.push(shopId);
  await run(`UPDATE shops SET ${updates.join(', ')} WHERE id = ?`, values);

  return NextResponse.json({ ok: true });
}
