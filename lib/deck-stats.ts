export interface CardStats {
  cmc: number | null;
  colors: string[];
  typeLine: string | null;
}

export const BASIC_LANDS_SET = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest',
]);

export type ColorKey = 'W' | 'U' | 'B' | 'R' | 'G' | 'M' | 'C';
export const COLOR_ORDER: ColorKey[] = ['W', 'U', 'B', 'R', 'G', 'M', 'C'];
export const COLOR_BG: Record<ColorKey, string> = {
  W: '#f9fafb', U: '#3b82f6', B: '#6b7280', R: '#ef4444', G: '#22c55e', M: '#f59e0b', C: '#78716c',
};
export const COLOR_LABELS: Record<ColorKey, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', M: 'Multi', C: 'Colorless',
};

export type ManaCurveBucket = Record<ColorKey, number> & { total: number };

/** Mana curve: stacked by color identity, non-land cards only, bucketed CMC 0-7+. */
export function computeManaCurve(
  cards: Record<string, number>,
  cardData: Map<string, CardStats>
): ManaCurveBucket[] {
  const empty = (): ManaCurveBucket => ({ W: 0, U: 0, B: 0, R: 0, G: 0, M: 0, C: 0, total: 0 });
  const buckets: ManaCurveBucket[] = Array.from({ length: 8 }, empty);

  for (const [name, qty] of Object.entries(cards)) {
    if (BASIC_LANDS_SET.has(name)) continue;
    const data = cardData.get(name.toLowerCase());
    const typeLine = (data?.typeLine ?? '').toLowerCase();
    if (typeLine.includes('land')) continue;
    const cmc = data?.cmc ?? null;
    if (cmc === null) continue;
    const colors = data?.colors ?? [];
    let colorKey: ColorKey;
    if (colors.length === 0) colorKey = 'C';
    else if (colors.length > 1) colorKey = 'M';
    else colorKey = colors[0] as ColorKey;
    const b = Math.min(Math.floor(cmc), 7);
    buckets[b][colorKey] += qty;
    buckets[b].total += qty;
  }
  return buckets;
}

const TYPE_ORDER = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Battle', 'Land', 'Other'];

/** Card type breakdown by count, ordered and filtered to non-zero rows. */
export function computeCardTypeCounts(
  cards: Record<string, number>,
  cardData: Map<string, CardStats>
): { type: string; count: number }[] {
  const counts: Record<string, number> = Object.fromEntries(TYPE_ORDER.map(t => [t, 0]));
  for (const [name, qty] of Object.entries(cards)) {
    const data = cardData.get(name.toLowerCase());
    const tl = (data?.typeLine ?? (BASIC_LANDS_SET.has(name) ? 'Basic Land' : '')).toLowerCase();
    if (tl.includes('creature')) counts['Creature'] += qty;
    else if (tl.includes('instant')) counts['Instant'] += qty;
    else if (tl.includes('sorcery')) counts['Sorcery'] += qty;
    else if (tl.includes('enchantment')) counts['Enchantment'] += qty;
    else if (tl.includes('artifact')) counts['Artifact'] += qty;
    else if (tl.includes('planeswalker')) counts['Planeswalker'] += qty;
    else if (tl.includes('battle')) counts['Battle'] += qty;
    else if (tl.includes('land')) counts['Land'] += qty;
    else counts['Other'] += qty;
  }
  return TYPE_ORDER.map(t => ({ type: t, count: counts[t] })).filter(r => r.count > 0);
}
