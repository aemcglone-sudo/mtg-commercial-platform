import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE id = ? AND "userId" = ?`, [shopId, userId]);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await run(`UPDATE shops SET site_status = 'published', published_at = NOW() WHERE id = ?`, [shopId]);
  return NextResponse.json({ ok: true });
}
