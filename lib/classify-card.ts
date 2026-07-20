export const CARD_CATEGORIES = [
  'Ramp',
  'Draw',
  'Tutors',
  'Removal',
  'Board Wipes',
  'Counters',
  'Recursion',
  'Evasion',
  'Pillow Fort',
  'Utility',
] as const;

export type CardCategory = (typeof CARD_CATEGORIES)[number];

interface ClassifiableCard {
  typeLine: string | null;
  oracleText: string | null;
  cmc: number | null;
}

function has(text: string, ...phrases: string[]): boolean {
  return phrases.some((p) => text.includes(p));
}

export function classifyCard(card: ClassifiableCard): CardCategory[] {
  const text = (card.oracleText ?? '').toLowerCase();
  const type = (card.typeLine ?? '').toLowerCase();
  const cmc = card.cmc ?? 0;
  const categories: CardCategory[] = [];

  const isRamp =
    (has(type, 'creature', 'artifact') && /(add|tap:).{0,20}\{[wubrgc0-9/]+\}/.test(text) && !type.includes('land')) ||
    (has(text, 'search your library for a') && has(text, 'land') && has(text, 'battlefield'));
  if (isRamp) categories.push('Ramp');

  const isBoardWipe =
    has(text, 'all creatures') && has(text, 'destroy', 'exile', 'sacrifice') ||
    has(text, 'each creature') && has(text, 'destroy', 'exile');
  if (isBoardWipe) categories.push('Board Wipes');

  const isRemoval =
    !isBoardWipe &&
    has(text, 'destroy target creature', 'exile target creature', 'destroy target creature or planeswalker') &&
    cmc <= 5;
  if (isRemoval) categories.push('Removal');

  const isTutor =
    has(text, 'search your library for a card') ||
    (has(text, 'search your library for') && !has(text, 'land'));
  if (isTutor) categories.push('Tutors');

  const isDraw =
    !isTutor &&
    has(text, 'draw a card', 'draw two cards', 'draw cards', 'draw a card for each');
  if (isDraw) categories.push('Draw');

  const isCounter =
    type.includes('instant') && has(text, 'counter target spell');
  if (isCounter) categories.push('Counters');

  const isRecursion =
    (has(text, 'return target creature') && has(text, 'graveyard') && has(text, 'battlefield')) ||
    (has(text, 'from your graveyard') && has(text, 'battlefield'));
  if (isRecursion) categories.push('Recursion');

  const isEvasion =
    has(text, 'flying', 'unblockable', 'shadow', 'menace', 'can\'t be blocked') &&
    (type.includes('aura') || type.includes('equipment') || has(text, 'target creature you control gains', 'equipped creature'));
  if (isEvasion) categories.push('Evasion');

  const isPillowFort =
    has(text, "can't attack you", "can't attack unless", 'prevent all combat damage', 'creatures can\'t attack');
  if (isPillowFort) categories.push('Pillow Fort');

  if (categories.length === 0 && (card.oracleText || card.typeLine)) {
    categories.push('Utility');
  }

  return categories;
}
