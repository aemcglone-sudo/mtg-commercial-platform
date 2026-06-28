import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany, run } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { randomUUID } from 'crypto';

interface RuleRow {
  id: string;
  priority: number;
  scope_conditions: string[] | string;
  scope_rarities: string[] | string;
  scope_set_codes: string[] | string;
  scope_price_min_cents: number | null;
  scope_price_max_cents: number | null;
  strategy: string;
  strategy_value: string | number | null;
  strategy_direction: string | null;
  floor_price_cents: number | null;
  is_active: boolean;
  created_at: string;
}

function parseArray(val: string[] | string | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  // PostgreSQL returns arrays as "{A,B,C}"
  const str = String(val);
  if (str === '{}') return [];
  return str.replace(/^\{|\}$/g, '').split(',').filter(Boolean);
}

function formatRule(r: RuleRow) {
  return {
    id: r.id,
    priority: r.priority,
    scopeConditions: parseArray(r.scope_conditions),
    scopeRarities: parseArray(r.scope_rarities),
    scopeSetCodes: parseArray(r.scope_set_codes),
    scopePriceMinCents: r.scope_price_min_cents,
    scopePriceMaxCents: r.scope_price_max_cents,
    strategy: r.strategy,
    strategyValue: r.strategy_value != null ? Number(r.strategy_value) : null,
    strategyDirection: r.strategy_direction,
    floorPriceCents: r.floor_price_cents,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ rules: [] });

  const rows = await findMany<RuleRow>(
    'SELECT * FROM shop_pricing_rules WHERE shop_id = ? AND is_active IS NOT FALSE ORDER BY priority ASC',
    [shop.id]
  );

  return NextResponse.json({ rules: rows.map(formatRule) });
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as {
    scopeConditions?: string[];
    scopeRarities?: string[];
    scopeSetCodes?: string[];
    scopePriceMinCents?: number | null;
    scopePriceMaxCents?: number | null;
    strategy: string;
    strategyValue?: number | null;
    strategyDirection?: string | null;
    floorPriceCents?: number | null;
  };

  // Find next priority
  const maxRow = await findOne<{ max: number }>(
    'SELECT COALESCE(MAX(priority), 0) as max FROM shop_pricing_rules WHERE shop_id = ?',
    [shop.id]
  );
  const priority = (maxRow?.max ?? 0) + 1;

  const id = randomUUID();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO shop_pricing_rules
      (id, shop_id, priority, scope_conditions, scope_rarities, scope_set_codes,
       scope_price_min_cents, scope_price_max_cents, strategy, strategy_value,
       strategy_direction, floor_price_cents, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?)`,
    [
      id, shop.id, priority,
      `{${(body.scopeConditions ?? []).join(',')}}`,
      `{${(body.scopeRarities ?? []).join(',')}}`,
      `{${(body.scopeSetCodes ?? []).join(',')}}`,
      body.scopePriceMinCents ?? null,
      body.scopePriceMaxCents ?? null,
      body.strategy,
      body.strategyValue ?? null,
      body.strategyDirection ?? null,
      body.floorPriceCents ?? null,
      now, now,
    ]
  );

  return NextResponse.json({ ok: true, id });
}
