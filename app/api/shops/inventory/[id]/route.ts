import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const body = await req.json() as {
    quantity?: number;
    priceCents?: number;
    condition?: string;
    foil?: boolean;
    notes?: string;
  };

  const sets: string[] = [];
  const args: (string | number | boolean | null)[] = [];

  if (body.quantity !== undefined) { sets.push('"quantity" = ?'); args.push(body.quantity); }
  if (body.priceCents !== undefined) {
    sets.push('"priceCents" = ?'); args.push(body.priceCents);
    sets.push('price_updated_at = ?'); args.push(new Date().toISOString());
  }
  if (body.condition !== undefined) { sets.push('condition = ?'); args.push(body.condition); }
  if (body.foil !== undefined) { sets.push('foil = ?'); args.push(body.foil); }
  if (body.notes !== undefined) { sets.push('notes = ?'); args.push(body.notes); }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  sets.push('"updatedAt" = ?');
  args.push(new Date().toISOString());
  args.push(id);

  const existing = await findOne<{ id: string }>(
    'SELECT id FROM shop_inventory WHERE id = ?',
    [id]
  );
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await run(
    `UPDATE shop_inventory SET ${sets.join(', ')} WHERE id = ?`,
    args
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(req);
  if (role !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const existing = await findOne<{ id: string }>(
    'SELECT id FROM shop_inventory WHERE id = ?',
    [id]
  );
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await run('DELETE FROM shop_inventory WHERE id = ?', [id]);

  return NextResponse.json({ ok: true });
}
