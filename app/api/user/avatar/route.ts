import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { run } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = '/data/uploads/avatars';
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large — max 2 MB' }, { status: 413 });
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${userId}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(bytes));

  const url = `/api/uploads/avatars/${filename}`;
  await run(`UPDATE users SET "avatarUrl" = ?, "updatedAt" = NOW() WHERE id = ?`, [url, userId]);

  return NextResponse.json({ url });
}

export async function DELETE(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await run(`UPDATE users SET "avatarUrl" = NULL, "updatedAt" = NOW() WHERE id = ?`, [userId]);
  return NextResponse.json({ ok: true });
}
