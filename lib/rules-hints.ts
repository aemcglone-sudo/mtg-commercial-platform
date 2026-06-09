/**
 * Maps Magic keywords and rules text to plain-English teaching hints.
 * Used to guide players on complex timing interactions.
 */

const RULES_HINTS: Record<string, string> = {
  // Instant-speed mechanics
  flash: 'Can be cast on your opponent\'s turn',
  instant: 'Casts at instant speed — can respond to spells',
  'in response': 'This mechanic responds to another spell or ability',
  counter: 'Can interrupt and prevent an opponent\'s spell',

  // Stack and timing
  'on the stack': 'Spell is waiting to resolve — opponents can respond',
  trigger: 'Triggers automatically when condition is met',
  'cast this spell': 'You have a brief window for responses before it resolves',
  ability: 'Can be activated even at instant speed if it says so',

  // Advanced interactions
  priority: 'Players take turns responding — understand who acts when',
  'in response to': 'This happens as a reaction to something else',
};

const KEYWORD_PATTERNS = Object.keys(RULES_HINTS);

/**
 * Returns a teaching hint if the oracle text contains stack-relevant keywords.
 * Returns null if no keywords match.
 */
export function getRulesHint(oracleText: string | null | undefined): string | null {
  if (!oracleText) return null;

  const lowerText = oracleText.toLowerCase();
  for (const keyword of KEYWORD_PATTERNS) {
    if (lowerText.includes(keyword)) {
      return RULES_HINTS[keyword];
    }
  }

  return null;
}

/**
 * Detects if a card is instant-speed (flash, instant type, or counter ability).
 * Used for contextual tooltips when adding cards to decks.
 */
export function isInstantSpeed(card: {
  typeLine?: string | null;
  oracleText?: string | null;
}): boolean {
  if (!card.typeLine && !card.oracleText) return false;

  const type = (card.typeLine || '').toLowerCase();
  const oracle = (card.oracleText || '').toLowerCase();

  return (
    type.includes('instant') ||
    oracle.includes('flash') ||
    oracle.includes('counter target') ||
    oracle.includes('in response')
  );
}
