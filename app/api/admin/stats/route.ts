import { NextRequest, NextResponse } from 'next/server';
import { findOne } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [users, shops, collectors, shopOwners, shopInventory, collectionItems] = await Promise.all([
    findOne<{ count: string }>('SELECT COUNT(*) as count FROM users', []),
    findOne<{ count: string }>('SELECT COUNT(*) as count FROM shops', []),
    findOne<{ count: string }>('SELECT COUNT(*) as count FROM users WHERE role = ?', ['collector']),
    findOne<{ count: string }>('SELECT COUNT(*) as count FROM users WHERE role = ?', ['shop_owner']),
    findOne<{ count: string }>('SELECT COUNT(*) as count FROM shop_inventory', []),
    findOne<{ count: string }>('SELECT COUNT(*) as count FROM inventory_items', []),
  ]);

  return NextResponse.json({
    totalUsers: Number(users?.count ?? 0),
    totalShops: Number(shops?.count ?? 0),
    totalCollectors: Number(collectors?.count ?? 0),
    totalShopOwners: Number(shopOwners?.count ?? 0),
    totalShopInventory: Number(shopInventory?.count ?? 0),
    totalCollectionItems: Number(collectionItems?.count ?? 0),
  });
}
