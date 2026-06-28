import { NextRequest, NextResponse } from 'next/server';
import { findOne, findMany } from '@/lib/db';
import { getRole, getAuthenticatedUserId } from '@/lib/auth';
import { applyFloor, applyStrategy, applyRules, type FloorPrices, type ConditionMatrix, type PricingRule } from '@/lib/pricing';

interface InventoryRow {
  id: string;
  cardName: string;
  condition: string;
  rarity: string | null;
  setCode: string;
  priceCents: number;
  scryfallId: string;
}

interface SnapshotRow {
  scryfallId: string;
  priceCents: number;
}

interface ScopeConfig {
  type: 'all' | 'filter' | 'stale';
  conditions?: string[];
  rarities?: string[];
  setCodes?: string[];
  priceTier?: string;
  staleDays?: number;
  staleMovePct?: number;
}

interface StrategyConfig {
  type: 'rules' | 'market_exact' | 'market_pct' | 'flat' | 'condition_matrix';
  direction?: 'above' | 'below';
  value?: number;
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = getAuthenticatedUserId(req)!;
  const shop = await findOne<{ id: string; conditionMatrix: unknown; floorPrices: unknown }>(
    'SELECT id, condition_matrix as "conditionMatrix", floor_prices as "floorPrices" FROM shops WHERE "userId" = ?',
    [userId]
  );
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const matrix = (shop.conditionMatrix ?? { NM: 100, LP: 85, MP: 70, HP: 50, DMG: 25 }) as ConditionMatrix;
  const floors = (shop.floorPrices ?? { global: 10, C: 10, U: 25, R: 50, M: 100 }) as FloorPrices;

  const body = await req.json() as { scope: ScopeConfig; strategy: StrategyConfig; respectFloors: boolean };
  const { scope, strategy, respectFloors } = body;

  // Fetch inventory with optional scope filters
  let whereClause = '"shopId" = ? AND quantity > 0';
  const whereArgs: (string | number)[] = [shop.id];

  if (scope.type === 'filter') {
    if (scope.conditions?.length) { whereClause += ` AND condition = ANY(ARRAY[${scope.conditions.map(() => '?').join(',')}]::text[])`; whereArgs.push(...scope.conditions); }
    if (scope.rarities?.length) { whereClause += ` AND rarity = ANY(ARRAY[${scope.rarities.map(() => '?').join(',')}]::text[])`; whereArgs.push(...scope.rarities); }
    if (scope.setCodes?.length) { whereClause += ` AND "setCode" = ANY(ARRAY[${scope.setCodes.map(() => '?').join(',')}]::text[])`; whereArgs.push(...scope.setCodes); }
  }

  if (scope.type === 'stale') {
    const days = scope.staleDays ?? 30;
    whereClause += ` AND (price_updated_at IS NULL OR price_updated_at < NOW() - INTERVAL '${days} days')`;
  }

  const items = await findMany<InventoryRow>(
    `SELECT id, "cardName", condition, rarity, "setCode", "priceCents", "scryfallId"
     FROM shop_inventory WHERE ${whereClause}`,
    whereArgs
  );

  if (items.length === 0) {
    return NextResponse.json({ items: [], totalCurrentCents: 0, totalNewCents: 0, floorHitCount: 0 });
  }

  // Fetch latest market prices from card_price_snapshots
  const scryfallIds = [...new Set(items.map(i => i.scryfallId))];
  const snapshots = await findMany<SnapshotRow>(
    `SELECT DISTINCT ON ("scryfallId") "scryfallId", "priceCents"
     FROM card_price_snapshots
     WHERE "scryfallId" = ANY(ARRAY[${scryfallIds.map(() => '?').join(',')}]::text[])
     ORDER BY "scryfallId", "capturedAt" DESC`,
    scryfallIds
  );
  const marketMap = new Map(snapshots.map(s => [s.scryfallId, s.priceCents]));

  // Fetch rules if needed
  let rules: PricingRule[] = [];
  if (strategy.type === 'rules') {
    const ruleRows = await findMany<{
      id: string; priority: number; scope_conditions: string; scope_rarities: string;
      scope_set_codes: string; scope_price_min_cents: number | null; scope_price_max_cents: number | null;
      strategy: string; strategy_value: string | null; strategy_direction: string | null;
      floor_price_cents: number | null; is_active: boolean;
    }>('SELECT * FROM shop_pricing_rules WHERE shop_id = ? AND is_active = true ORDER BY priority', [shop.id]);

    rules = ruleRows.map(r => ({
      id: r.id,
      priority: r.priority,
      scopeConditions: r.scope_conditions ? String(r.scope_conditions).replace(/^\{|\}$/g, '').split(',').filter(Boolean) : [],
      scopeRarities: r.scope_rarities ? String(r.scope_rarities).replace(/^\{|\}$/g, '').split(',').filter(Boolean) : [],
      scopeSetCodes: r.scope_set_codes ? String(r.scope_set_codes).replace(/^\{|\}$/g, '').split(',').filter(Boolean) : [],
      scopePriceMinCents: r.scope_price_min_cents,
      scopePriceMaxCents: r.scope_price_max_cents,
      strategy: r.strategy as PricingRule['strategy'],
      strategyValue: r.strategy_value != null ? Number(r.strategy_value) : null,
      strategyDirection: r.strategy_direction as 'above' | 'below' | null,
      floorPriceCents: r.floor_price_cents,
      isActive: r.is_active,
    }));
  }

  // Compute new prices
  const results: { id: string; cardName: string; condition: string; currentCents: number; newCents: number; hitFloor: boolean }[] = [];

  for (const item of items) {
    const marketCents = marketMap.get(item.scryfallId) ?? item.priceCents;
    let newCents = item.priceCents;
    let hitFloor = false;

    if (strategy.type === 'rules') {
      const res = applyRules(item, marketCents, rules, matrix, floors, respectFloors);
      newCents = res.newCents;
      hitFloor = res.hitFloor;
    } else if (strategy.type === 'market_exact') {
      newCents = marketCents;
    } else if (strategy.type === 'market_pct') {
      newCents = applyStrategy(marketCents, item.priceCents, item.condition, 'market_pct', strategy.value ?? 0, strategy.direction ?? 'above', matrix);
    } else if (strategy.type === 'flat') {
      newCents = Math.round((strategy.value ?? 0) * 100);
    } else if (strategy.type === 'condition_matrix') {
      newCents = applyStrategy(marketCents, item.priceCents, item.condition, 'condition_matrix_pct', null, null, matrix);
    }

    if (respectFloors && strategy.type !== 'rules') {
      const floored = applyFloor(newCents, item.rarity, floors);
      if (floored > newCents) { newCents = floored; hitFloor = true; }
    }

    results.push({ id: item.id, cardName: item.cardName, condition: item.condition, currentCents: item.priceCents, newCents, hitFloor });
  }

  results.sort((a, b) => Math.abs(b.newCents - b.currentCents) - Math.abs(a.newCents - a.currentCents));

  return NextResponse.json({
    items: results,
    totalCurrentCents: results.reduce((s, r) => s + r.currentCents, 0),
    totalNewCents: results.reduce((s, r) => s + r.newCents, 0),
    floorHitCount: results.filter(r => r.hitFloor).length,
  });
}
