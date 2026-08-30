export const LANE_ORDER = ['Creature', 'Planeswalker', 'Artifact', 'Enchantment', 'Battle', 'Land', 'Other'] as const;
export type Lane = (typeof LANE_ORDER)[number];

/** Which battlefield lane a permanent belongs in, based on its type line. */
export function laneForTypeLine(typeLine: string | null | undefined): Lane {
  const tl = (typeLine ?? '').toLowerCase();
  if (tl.includes('creature')) return 'Creature';
  if (tl.includes('planeswalker')) return 'Planeswalker';
  if (tl.includes('artifact')) return 'Artifact';
  if (tl.includes('enchantment')) return 'Enchantment';
  if (tl.includes('battle')) return 'Battle';
  if (tl.includes('land')) return 'Land';
  return 'Other';
}

/** Groups a list of items into lanes by type line, dropping empty lanes, in LANE_ORDER. */
export function groupByLane<T>(items: T[], getTypeLine: (item: T) => string | null | undefined): { lane: Lane; items: T[] }[] {
  const buckets = new Map<Lane, T[]>();
  for (const lane of LANE_ORDER) buckets.set(lane, []);
  for (const item of items) {
    const lane = laneForTypeLine(getTypeLine(item));
    buckets.get(lane)!.push(item);
  }
  return LANE_ORDER.filter(l => buckets.get(l)!.length > 0).map(l => ({ lane: l, items: buckets.get(l)! }));
}
