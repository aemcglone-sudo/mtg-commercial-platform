import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function resolveShop(req: NextRequest, shopId: string) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return null;
  return await findOne<{ id: string }>(`SELECT id FROM shops WHERE id = ? AND "userId" = ?`, [shopId, userId]);
}

// PATCH /api/shop-site/[shopId]/sections — bulk update visibility or reorder
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await resolveShop(req, shopId);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    updates?: { id: string; visible?: boolean; sortOrder?: number }[];
  };

  if (body.updates) {
    for (const u of body.updates) {
      if (u.visible !== undefined) {
        await run(`UPDATE shop_site_sections SET visible = ?, updated_at = NOW() WHERE id = ? AND shop_id = ?`, [u.visible, u.id, shopId]);
      }
      if (u.sortOrder !== undefined) {
        await run(`UPDATE shop_site_sections SET sort_order = ?, updated_at = NOW() WHERE id = ? AND shop_id = ?`, [u.sortOrder, u.id, shopId]);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
