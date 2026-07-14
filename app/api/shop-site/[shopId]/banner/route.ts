import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = '/data/uploads/shops';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

async function resolveShop(req: NextRequest, shopId: string) {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'shop_owner') return null;
  return findOne<{ id: string }>(`SELECT id FROM shops WHERE id = ? AND "userId" = ?`, [shopId, userId]);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await resolveShop(req, shopId);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large — max 5 MB' }, { status: 413 });
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const shopDir = path.join(UPLOAD_DIR, shopId);
  await mkdir(shopDir, { recursive: true });
  const filename = `banner.${ext}`;
  await writeFile(path.join(shopDir, filename), Buffer.from(bytes));

  const url = `/api/uploads/shops/${shopId}/${filename}`;
  await run(`UPDATE shops SET "bannerUrl" = ? WHERE id = ?`, [url, shopId]);

  return NextResponse.json({ url });
}
