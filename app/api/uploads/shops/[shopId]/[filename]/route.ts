import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = '/data/uploads/shops';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string; filename: string }> }) {
  const { shopId, filename } = await params;

  // Sanitize — only allow safe filenames (no path traversal)
  if (!/^[\w.-]+$/.test(filename) || !/^[\w-]+$/.test(shopId)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, shopId, filename);
  try {
    const data = await readFile(filePath);
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
