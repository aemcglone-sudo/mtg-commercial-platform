import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

async function updateStatus(req: NextRequest, params: Promise<{ id: string }>, status: string) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { id } = await params;
  const existing = await findOne<{ id: string }>(
    'SELECT id FROM shop_campaigns WHERE id = ? AND "shopId" = ?', [id, shopId]
  );
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await run(
    'UPDATE shop_campaigns SET status = ?, "updatedAt" = ? WHERE id = ?',
    [status, new Date().toISOString(), id]
  );
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Determine action from URL
  const url = req.nextUrl.pathname;
  if (url.endsWith('/dismiss')) return updateStatus(req, params, 'dismissed');
  if (url.endsWith('/launch')) return updateStatus(req, params, 'launched');
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
