export interface FloorPrices {
  global?: number;
  C?: number;
  U?: number;
  R?: number;
  M?: number;
}

export interface ConditionMatrix {
  NM?: number;
  LP?: number;
  MP?: number;
  HP?: number;
  DMG?: number;
}

export interface PricingRule {
  id: string;
  priority: number;
  scopeConditions: string[];
  scopeRarities: string[];
  scopeSetCodes: string[];
  scopePriceMinCents: number | null;
  scopePriceMaxCents: number | null;
  strategy: 'market_pct' | 'flat' | 'condition_matrix_pct';
  strategyValue: number | null;
  strategyDirection: 'above' | 'below' | null;
  floorPriceCents: number | null;
  isActive: boolean;
}

export function applyFloor(cents: number, rarity: string | null, floors: FloorPrices): number {
  const rarityFloor = rarity ? (floors[rarity as keyof FloorPrices] ?? 0) : 0;
  const globalFloor = floors.global ?? 0;
  const floor = Math.max(rarityFloor, globalFloor);
  return Math.max(cents, floor);
}

export function applyStrategy(
  marketCents: number,
  currentCents: number,
  condition: string,
  strategy: PricingRule['strategy'],
  strategyValue: number | null,
  strategyDirection: string | null,
  matrix: ConditionMatrix,
): number {
  if (strategy === 'flat') {
    return Math.round((strategyValue ?? 0) * 100);
  }
  if (strategy === 'market_pct') {
    const pct = strategyValue ?? 0;
    const multiplier = strategyDirection === 'below' ? (1 - pct / 100) : (1 + pct / 100);
    return Math.round(marketCents * multiplier);
  }
  if (strategy === 'condition_matrix_pct') {
    const nmCents = marketCents; // market price assumed NM
    const condPct = matrix[condition as keyof ConditionMatrix] ?? 100;
    return Math.round(nmCents * condPct / 100);
  }
  return currentCents;
}

export function ruleMatchesItem(
  rule: PricingRule,
  item: { condition: string; rarity: string | null; setCode: string; priceCents: number },
): boolean {
  if (rule.scopeConditions.length > 0 && !rule.scopeConditions.includes(item.condition)) return false;
  if (rule.scopeRarities.length > 0 && (!item.rarity || !rule.scopeRarities.includes(item.rarity.toUpperCase()))) return false;
  if (rule.scopeSetCodes.length > 0 && !rule.scopeSetCodes.includes(item.setCode.toUpperCase())) return false;
  if (rule.scopePriceMinCents != null && item.priceCents < rule.scopePriceMinCents) return false;
  if (rule.scopePriceMaxCents != null && item.priceCents > rule.scopePriceMaxCents) return false;
  return true;
}

export function applyRules(
  item: { condition: string; rarity: string | null; setCode: string; priceCents: number },
  marketCents: number,
  rules: PricingRule[],
  matrix: ConditionMatrix,
  floors: FloorPrices,
  respectFloors: boolean,
): { newCents: number; matchedRule: PricingRule | null; hitFloor: boolean } {
  const sorted = [...rules].filter(r => r.isActive).sort((a, b) => a.priority - b.priority);
  const matched = sorted.find(r => ruleMatchesItem(r, item)) ?? null;

  if (!matched) {
    return { newCents: item.priceCents, matchedRule: null, hitFloor: false };
  }

  let newCents = applyStrategy(
    marketCents,
    item.priceCents,
    item.condition,
    matched.strategy,
    matched.strategyValue != null ? Number(matched.strategyValue) : null,
    matched.strategyDirection,
    matrix,
  );

  let hitFloor = false;
  if (respectFloors) {
    const ruleFloor = matched.floorPriceCents;
    if (ruleFloor != null && newCents < ruleFloor) {
      newCents = ruleFloor;
      hitFloor = true;
    } else {
      const floored = applyFloor(newCents, item.rarity, floors);
      if (floored > newCents) { newCents = floored; hitFloor = true; }
    }
  }

  return { newCents, matchedRule: matched, hitFloor };
}
