import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { text, mergeMode } = await req.json() as { text?: string; mergeMode?: 'replace' | 'add' };
  if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 });

  const jobId = randomUUID();
  await run(
    `INSERT INTO inventory_upload_jobs (id, shop_id, status, merge_mode) VALUES (?, ?, 'pending', ?)`,
    [jobId, shop.id, mergeMode ?? 'add']
  );

  // Fire-and-forget background processing
  // Use localhost to avoid Fly.io public URL routing issues for internal self-calls
  fetch(`http://localhost:3000/api/background/process-inventory-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, text, shopId: shop.id, mergeMode: mergeMode ?? 'add' }),
  }).catch(() => {});

  return NextResponse.json({ jobId });
}
