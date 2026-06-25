import { NextRequest, NextResponse } from 'next/server';
import { findMany, findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ items: [], total: 0 });

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search') ?? '';
  const condition = searchParams.get('condition') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['"shopId" = ?'];
  const args: (string | number | null)[] = [shopId];

  if (search) {
    conditions.push('"cardName" ILIKE ?');
    args.push(`%${search}%`);
  }
  if (condition) {
    conditions.push('condition = ?');
    args.push(condition);
  }

  const where = conditions.join(' AND ');

  const [countRow, items] = await Promise.all([
    findOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM shop_inventory WHERE ${where}`,
      args
    ),
    findMany<{
      id: string;
      cardName: string;
      setCode: string;
      collectorNumber: string | null;
      condition: string;
      foil: boolean;
      language: string;
      quantity: number;
      priceCents: number;
      imageUrl: string | null;
      scryfallId: string;
      notes: string | null;
      createdAt: string;
      typeLine: string | null;
      colors: string | null;
      cmc: number | null;
      rarity: string | null;
    }>(
      `SELECT id, "cardName", "setCode", "collectorNumber", condition, foil, language,
              quantity, "priceCents", "imageUrl", "scryfallId", notes, "createdAt",
              "typeLine", colors, cmc, rarity
       FROM shop_inventory
       WHERE ${where}
       ORDER BY "cardName" ASC
       LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    ),
  ]);

  return NextResponse.json({
    items,
    total: parseInt(countRow?.count ?? '0', 10),
    page,
    pages: Math.ceil(parseInt(countRow?.count ?? '0', 10) / limit),
  });
}

export async function DELETE(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { count } = await findOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM shop_inventory WHERE "shopId" = ?',
    [shopId]
  ) ?? { count: '0' };
  await run('DELETE FROM shop_inventory WHERE "shopId" = ?', [shopId]);
  return NextResponse.json({ deleted: parseInt(count, 10) });
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'No shop found' }, { status: 404 });

  const body = await req.json() as {
    cards: Array<{
      scryfallId: string;
      cardName: string;
      setCode: string;
      collectorNumber?: string;
      condition: string;
      foil: boolean;
      language?: string;
      quantity: number;
      priceCents: number;
      notes?: string;
      imageUrl?: string;
      typeLine?: string | null;
      colors?: string[];
      cmc?: number | null;
      rarity?: string | null;
    }>;
  };

  if (!Array.isArray(body.cards) || body.cards.length === 0) {
    return NextResponse.json({ error: 'No cards provided' }, { status: 400 });
  }

  const now = new Date().toISOString();
  let added = 0;

  for (const card of body.cards) {
    await run(
      `INSERT INTO shop_inventory
         (id, "shopId", "scryfallId", "cardName", "setCode", "collectorNumber",
          condition, foil, language, quantity, "priceCents", notes, "imageUrl",
          "typeLine", colors, cmc, rarity,
          "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        shopId,
        card.scryfallId,
        card.cardName,
        card.setCode,
        card.collectorNumber ?? null,
        card.condition,
        card.foil,
        card.language ?? 'en',
        card.quantity,
        card.priceCents,
        card.notes ?? null,
        card.imageUrl ?? null,
        card.typeLine ?? null,
        card.colors ? JSON.stringify(card.colors) : null,
        card.cmc ?? null,
        card.rarity ?? null,
        now,
        now,
      ]
    );
    added++;
  }

  return NextResponse.json({ added });
}
