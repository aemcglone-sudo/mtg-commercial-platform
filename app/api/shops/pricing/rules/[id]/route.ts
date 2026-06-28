import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const existing = await findOne<{ id: string }>(
    'SELECT id FROM shop_pricing_rules WHERE id = ? AND shop_id = ?',
    [id, shop.id]
  );
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as {
    scopeConditions?: string[];
    scopeRarities?: string[];
    scopeSetCodes?: string[];
    scopePriceMinCents?: number | null;
    scopePriceMaxCents?: number | null;
    strategy?: string;
    strategyValue?: number | null;
    strategyDirection?: string | null;
    floorPriceCents?: number | null;
    isActive?: boolean;
  };

  const sets: string[] = [];
  const args: unknown[] = [];

  if (body.scopeConditions !== undefined) { sets.push('scope_conditions = ?'); args.push(`{${body.scopeConditions.join(',')}}`); }
  if (body.scopeRarities !== undefined) { sets.push('scope_rarities = ?'); args.push(`{${body.scopeRarities.join(',')}}`); }
  if (body.scopeSetCodes !== undefined) { sets.push('scope_set_codes = ?'); args.push(`{${body.scopeSetCodes.join(',')}}`); }
  if (body.scopePriceMinCents !== undefined) { sets.push('scope_price_min_cents = ?'); args.push(body.scopePriceMinCents); }
  if (body.scopePriceMaxCents !== undefined) { sets.push('scope_price_max_cents = ?'); args.push(body.scopePriceMaxCents); }
  if (body.strategy !== undefined) { sets.push('strategy = ?'); args.push(body.strategy); }
  if (body.strategyValue !== undefined) { sets.push('strategy_value = ?'); args.push(body.strategyValue); }
  if (body.strategyDirection !== undefined) { sets.push('strategy_direction = ?'); args.push(body.strategyDirection); }
  if (body.floorPriceCents !== undefined) { sets.push('floor_price_cents = ?'); args.push(body.floorPriceCents); }
  if (body.isActive !== undefined) { sets.push('is_active = ?'); args.push(body.isActive); }

  if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  await run(`UPDATE shop_pricing_rules SET ${sets.join(', ')} WHERE id = ?`, args as (string | number | boolean | null)[]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  await run('DELETE FROM shop_pricing_rules WHERE id = ? AND shop_id = ?', [id, shop.id]);

  return NextResponse.json({ ok: true });
}
