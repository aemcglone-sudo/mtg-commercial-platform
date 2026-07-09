import { NextRequest, NextResponse } from 'next/server';
import { findMany, run } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shops = await findMany<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    email: string | null;
    createdAt: string;
    ownerName: string | null;
    ownerEmail: string;
    inventoryCount: string;
  }>(`
    SELECT
      s.id, s.name, s.city, s.state, s.email, s."createdAt",
      u.name as "ownerName", u.email as "ownerEmail",
      COUNT(si.id) as "inventoryCount"
    FROM shops s
    JOIN users u ON u.id = s."userId"
    LEFT JOIN shop_inventory si ON si."shopId" = s.id
    GROUP BY s.id, u.name, u.email
    ORDER BY s."createdAt" DESC
  `, []);

  return NextResponse.json({ shops: shops.map(s => ({ ...s, inventoryCount: Number(s.inventoryCount) })) });
}

export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  // Delete child records with RESTRICT FK before deleting the shop
  await run(`DELETE FROM shop_order_items WHERE "orderId" IN (SELECT id FROM shop_orders WHERE "shopId" = ?)`, [id]);
  await run(`DELETE FROM shop_orders WHERE "shopId" = ?`, [id]);
  await run(`DELETE FROM shops WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
