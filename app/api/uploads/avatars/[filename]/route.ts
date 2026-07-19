import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  try {
    const buf = await readFile(path.join('/data/uploads/avatars', filename));
    return new NextResponse(buf, {
      headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
