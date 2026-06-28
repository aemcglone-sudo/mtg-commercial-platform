import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string; conditionMatrix: unknown }>(
    'SELECT id, condition_matrix as "conditionMatrix" FROM shops WHERE "userId" = ?',
    [userId]
  );
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const matrix = shop.conditionMatrix ?? { NM: 100, LP: 85, MP: 70, HP: 50, DMG: 25 };
  return NextResponse.json({ matrix });
}

export async function PATCH(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { matrix } = await req.json() as { matrix: Record<string, number> };
  if (!matrix || typeof matrix !== 'object') return NextResponse.json({ error: 'Invalid matrix' }, { status: 400 });

  await run(
    `UPDATE shops SET condition_matrix = ?, "updatedAt" = ? WHERE id = ?`,
    [JSON.stringify(matrix), new Date().toISOString(), shop.id]
  );

  return NextResponse.json({ ok: true });
}
