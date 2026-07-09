import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { findOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getShopId(slug: string): Promise<string | null> {
  const row = await findOne<{ id: string }>('SELECT id FROM shops WHERE slug = ?', [slug]);
  return row?.id ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession(req);
  if (!session?.userId) return NextResponse.json({ favorited: false });
  const { slug } = await params;
  const shopId = await getShopId(slug);
  if (!shopId) return NextResponse.json({ favorited: false });
  const row = await findOne('SELECT id FROM collector_favorite_shops WHERE "userId" = ? AND "shopId" = ?', [session.userId, shopId]);
  return NextResponse.json({ favorited: !!row });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession(req);
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  const shopId = await getShopId(slug);
  if (!shopId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await run('INSERT INTO collector_favorite_shops ("userId","shopId") VALUES (?,?) ON CONFLICT DO NOTHING', [session.userId, shopId]);
  return NextResponse.json({ favorited: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession(req);
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  const shopId = await getShopId(slug);
  if (!shopId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await run('DELETE FROM collector_favorite_shops WHERE "userId" = ? AND "shopId" = ?', [session.userId, shopId]);
  return NextResponse.json({ favorited: false });
}
