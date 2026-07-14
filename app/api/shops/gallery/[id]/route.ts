import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { deleteFromR2, keyFromUrl } from '@/lib/storage/r2';

export const dynamic = 'force-dynamic';

async function getShopId(req: NextRequest): Promise<string | null> {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'shop_owner') return null;
  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  return shop?.id ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const shopId = await getShopId(req);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { caption?: string };

  await run(
    `UPDATE shop_gallery_images SET caption = ?, updated_at = NOW()
     WHERE id = ? AND shop_id = ?`,
    [body.caption ?? null, id, shopId]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const shopId = await getShopId(req);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const image = await findOne<{ image_url: string; thumbnail_url: string }>(
    `SELECT image_url, thumbnail_url FROM shop_gallery_images WHERE id = ? AND shop_id = ?`,
    [id, shopId]
  );
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await Promise.all([
    deleteFromR2(keyFromUrl(image.image_url)),
    deleteFromR2(keyFromUrl(image.thumbnail_url)),
  ]);

  await run(`DELETE FROM shop_gallery_images WHERE id = ? AND shop_id = ?`, [id, shopId]);

  return NextResponse.json({ ok: true });
}
