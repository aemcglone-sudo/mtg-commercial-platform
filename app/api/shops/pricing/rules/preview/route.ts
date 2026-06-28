import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { ruleMatchesItem, type PricingRule } from '@/lib/pricing';

interface InventoryRow {
  id: string;
  cardName: string;
  condition: string;
  rarity: string | null;
  setCode: string;
  priceCents: number;
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as { rule: PricingRule };
  const rule = body.rule;

  const items = await findMany<InventoryRow>(
    'SELECT id, "cardName", condition, rarity, "setCode", "priceCents" FROM shop_inventory WHERE "shopId" = ? AND quantity > 0',
    [shop.id]
  );

  const matching = items.filter(item => ruleMatchesItem(rule, item));

  return NextResponse.json({
    affectedCount: matching.length,
    samples: matching.slice(0, 5).map(i => ({ id: i.id, cardName: i.cardName, condition: i.condition })),
  });
}
