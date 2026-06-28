import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';

async function getShopId(userId: string): Promise<string | null> {
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  return shop?.id ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { id } = await params;
  const body = await req.json() as {
    scopeConditions?: string[];
    scopeRarities?: string[];
    scopeSetCodes?: string[];
    scopePriceMinCents?: number | null;
    scopePriceMaxCents?: number | null;
    scopeTrendThresholdPct?: number | null;
    adjustmentType?: string;
    adjustmentValue?: number;
    isActive?: boolean;
  };

  const now = new Date().toISOString();
  await run(
    `UPDATE shop_buy_rules SET
      scope_conditions = COALESCE(?, scope_conditions),
      scope_rarities = COALESCE(?, scope_rarities),
      scope_set_codes = COALESCE(?, scope_set_codes),
      scope_price_min_cents = ?,
      scope_price_max_cents = ?,
      scope_trend_threshold_pct = ?,
      adjustment_type = COALESCE(?, adjustment_type),
      adjustment_value = COALESCE(?, adjustment_value),
      is_active = COALESCE(?, is_active),
      updated_at = ?
     WHERE id = ? AND shop_id = ?`,
    [
      body.scopeConditions != null ? `{${body.scopeConditions.join(',')}}` : null,
      body.scopeRarities != null ? `{${body.scopeRarities.join(',')}}` : null,
      body.scopeSetCodes != null ? `{${body.scopeSetCodes.join(',')}}` : null,
      body.scopePriceMinCents ?? null,
      body.scopePriceMaxCents ?? null,
      body.scopeTrendThresholdPct ?? null,
      body.adjustmentType ?? null,
      body.adjustmentValue ?? null,
      body.isActive ?? null,
      now,
      id, shopId,
    ]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shopId = await getShopId(userId);
  if (!shopId) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { id } = await params;
  await run('DELETE FROM shop_buy_rules WHERE id = ? AND shop_id = ?', [id, shopId]);

  return NextResponse.json({ ok: true });
}
