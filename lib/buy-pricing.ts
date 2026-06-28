export interface BuyMatrix {
  NM: number;
  LP: number;
  MP: number;
  HP: number;
  DMG: number;
}

export interface MarginTargets {
  under_1: number;
  '1_to_10': number;
  '10_to_50': number;
  over_50: number;
}

export interface BuyRule {
  id: string;
  priority: number;
  isActive: boolean;
  scopeConditions: string[];
  scopeRarities: string[];
  scopeSetCodes: string[];
  scopePriceMinCents: number | null;
  scopePriceMaxCents: number | null;
  scopeTrendThresholdPct: number | null;
  adjustmentType: 'pct_adjust' | 'flat';
  adjustmentValue: number;
}

export const DEFAULT_BUY_MATRIX: BuyMatrix = { NM: 60, LP: 51, MP: 42, HP: 30, DMG: 15 };
export const DEFAULT_MARGIN_TARGETS: MarginTargets = { under_1: 60, '1_to_10': 45, '10_to_50': 40, over_50: 35 };

export function getMarginTarget(tcgCents: number, targets: MarginTargets): number {
  const dollars = tcgCents / 100;
  if (dollars < 1) return targets.under_1;
  if (dollars < 10) return targets['1_to_10'];
  if (dollars < 50) return targets['10_to_50'];
  return targets.over_50;
}

export function buyRuleMatchesItem(
  rule: BuyRule,
  condition: string,
  rarity: string | null,
  setCode: string | null,
  tcgCents: number,
  trendPct7d: number | null,
): boolean {
  if (!rule.isActive) return false;
  if (rule.scopeConditions.length > 0 && !rule.scopeConditions.includes(condition)) return false;
  if (rule.scopeRarities.length > 0 && rarity && !rule.scopeRarities.includes(rarity)) return false;
  if (rule.scopeSetCodes.length > 0 && setCode && !rule.scopeSetCodes.includes(setCode)) return false;
  if (rule.scopePriceMinCents != null && tcgCents < rule.scopePriceMinCents) return false;
  if (rule.scopePriceMaxCents != null && tcgCents > rule.scopePriceMaxCents) return false;
  if (rule.scopeTrendThresholdPct != null && trendPct7d != null) {
    if (Math.abs(trendPct7d) < Math.abs(rule.scopeTrendThresholdPct)) return false;
  }
  return true;
}

export function computeBuyPrice(
  tcgCents: number,
  condition: string,
  rarity: string | null,
  setCode: string | null,
  matrix: BuyMatrix,
  rules: BuyRule[],
  trendPct7d?: number,
): { buyPriceCents: number; marginPct: number; warnings: string[] } {
  const condKey = condition as keyof BuyMatrix;
  const basePct = matrix[condKey] ?? matrix.NM;
  let buyPriceCents = Math.round(tcgCents * basePct / 100);

  const warnings: string[] = [];

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sortedRules) {
    if (buyRuleMatchesItem(rule, condition, rarity, setCode, tcgCents, trendPct7d ?? null)) {
      if (rule.adjustmentType === 'pct_adjust') {
        buyPriceCents = Math.round(buyPriceCents * (1 + rule.adjustmentValue / 100));
      } else {
        buyPriceCents = Math.round(rule.adjustmentValue * 100);
      }
      break;
    }
  }

  if (buyPriceCents < 0) buyPriceCents = 0;

  if (trendPct7d != null && trendPct7d < -10) {
    warnings.push(`Price trending down ${Math.abs(trendPct7d).toFixed(0)}% over 7 days`);
  }

  const marginPct = tcgCents > 0 ? Math.round((buyPriceCents / tcgCents) * 100) : 0;

  return { buyPriceCents, marginPct, warnings };
}
