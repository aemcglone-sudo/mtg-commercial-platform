import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany, run } from '@/lib/db';
import { uploadToR2 } from '@/lib/storage/r2';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 20;

async function getShopId(req: NextRequest): Promise<string | null> {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'shop_owner') return null;
  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  return shop?.id ?? null;
}

export async function GET(req: NextRequest) {
  const shopId = await getShopId(req);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const images = await findMany<{
    id: string; image_url: string; thumbnail_url: string; caption: string | null; sort_order: number;
  }>(
    `SELECT id, image_url, thumbnail_url, caption, sort_order
     FROM shop_gallery_images WHERE shop_id = ? ORDER BY sort_order ASC`,
    [shopId]
  );

  return NextResponse.json({
    images: images.map(i => ({
      id: i.id,
      imageUrl: i.image_url,
      thumbnailUrl: i.thumbnail_url,
      caption: i.caption,
      displayOrder: i.sort_order,
    })),
  });
}

export async function POST(req: NextRequest) {
  const shopId = await getShopId(req);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const countRow = await findOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM shop_gallery_images WHERE shop_id = ?`, [shopId]
  );
  if (parseInt(countRow?.count ?? '0', 10) >= MAX_IMAGES) {
    return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images per shop` }, { status: 422 });
  }

  const form = await req.formData();
  const file = form.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large — max 8 MB' }, { status: 413 });
  }

  const buffer = Buffer.from(bytes);
  const id = crypto.randomUUID();
  const fullKey = `shops/${shopId}/gallery/${id}.webp`;
  const thumbKey = `shops/${shopId}/gallery/${id}-thumb.webp`;

  const [fullBuffer, thumbBuffer] = await Promise.all([
    sharp(buffer).webp({ quality: 85 }).toBuffer(),
    sharp(buffer).resize(600, undefined, { withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
  ]);

  const [imageUrl, thumbnailUrl] = await Promise.all([
    uploadToR2(fullKey, fullBuffer, 'image/webp'),
    uploadToR2(thumbKey, thumbBuffer, 'image/webp'),
  ]);

  const caption = (form.get('caption') as string | null) || null;
  const maxOrderRow = await findOne<{ max: string | null }>(
    `SELECT MAX(sort_order)::text AS max FROM shop_gallery_images WHERE shop_id = ?`, [shopId]
  );
  const sortOrder = parseInt(maxOrderRow?.max ?? '-1', 10) + 1;

  await run(
    `INSERT INTO shop_gallery_images (id, shop_id, image_url, thumbnail_url, caption, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, shopId, imageUrl, thumbnailUrl, caption, sortOrder]
  );

  return NextResponse.json({ id, imageUrl, thumbnailUrl, caption, displayOrder: sortOrder });
}
