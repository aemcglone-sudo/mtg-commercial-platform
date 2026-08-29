// Official WotC Game Changers list (53 cards, February 2026)
export const GAME_CHANGERS = new Set([
  // White
  'Drannith Magistrate', 'Enlightened Tutor', 'Farewell', 'Humility', 'Smothering Tithe', "Teferi's Protection",
  // Blue
  'Consecrated Sphinx', 'Cyclonic Rift', 'Fierce Guardianship', 'Force of Will', 'Gifts Ungiven',
  'Intuition', 'Mystical Tutor', 'Narset, Parter of Veils', "Rhystic Study", "Thassa's Oracle",
  // Black
  'Ad Nauseam', "Bolas's Citadel", 'Braids, Cabal Minion', 'Demonic Tutor', 'Imperial Seal',
  'Necropotence', 'Opposition Agent', 'Orcish Bowmasters', 'Tergrid, God of Fright', 'Vampiric Tutor',
  // Red
  "Gamble", "Jeska's Will", 'Underworld Breach',
  // Green
  'Biorhythm', 'Crop Rotation', 'Natural Order', 'Seedborn Muse', 'Survival of the Fittest', 'Worldly Tutor',
  // Multi
  'Grand Arbiter Augustin IV', 'Notion Thief', 'Aura Shards', 'Coalition Victory',
  // Artifacts / Colorless
  'Chrome Mox', 'Grim Monolith', "Lion's Eye Diamond", 'Mana Crypt', 'Mana Vault',
  'Sensei\'s Divining Top', 'Sol Ring', 'The One Ring', 'Time Vault',
  // Extra turns
  'Time Walk', 'Time Warp', 'Temporal Manipulation', 'Capture of Jingzhou', 'Temporal Mastery',
  'Nexus of Fate', 'Expropriate',
  // Mass land denial
  'Armageddon', 'Ravages of War', 'Catastrophe', 'Decree of Annihilation', 'Jokulhaups',
]);

// Extra turn cards (Bracket 3+ regardless of Game Changer status)
export const EXTRA_TURNS = new Set([
  'Time Walk', 'Time Warp', 'Temporal Manipulation', 'Capture of Jingzhou',
  'Temporal Mastery', 'Nexus of Fate', 'Expropriate', 'Alrund\'s Epiphany',
  'Beacon of Tomorrows', 'Part the Waterveil', 'Savor the Moment', 'Walk the Aeons',
  'Karn\'s Temporal Sundering', 'Magistrate\'s Scepter', 'Medomai the Ageless',
  'Echo of Eons', 'Emrakul, the Promised End',
]);

// Mass land denial (Bracket 4 trigger)
export const MASS_LAND_DENIAL = new Set([
  'Armageddon', 'Ravages of War', 'Catastrophe', 'Decree of Annihilation',
  'Jokulhaups', 'Obliterate', 'Sunder', 'Boom // Bust', 'Cataclysm',
  'Fall of the Thran', 'Epicenter', 'Ruination', 'Price of Glory',
  'Wildfire', 'Keldon Firebombers',
]);

export interface BracketRating {
  bracket: 1 | 2 | 3 | 4 | 5;
  reasons: string[];
  gcCount: number;
  gameChangersInDeck: string[];
}

export const BRACKET_META: Record<number, { label: string; color: string; bg: string; desc: string }> = {
  1: { label: 'Exhibition', color: 'text-zinc-400', bg: 'bg-zinc-700', desc: 'Theme/flavor deck, minimal synergy' },
  2: { label: 'Core', color: 'text-green-400', bg: 'bg-green-900/40', desc: 'Focused strategy, no Game Changers or infinite combos' },
  3: { label: 'Upgraded', color: 'text-blue-400', bg: 'bg-blue-900/40', desc: '1–3 Game Changers or some combos' },
  4: { label: 'Optimized', color: 'text-amber-400', bg: 'bg-amber-900/40', desc: '4+ Game Changers, fast combos, or mass land denial' },
  5: { label: 'cEDH', color: 'text-red-400', bg: 'bg-red-900/40', desc: 'Fully tuned, tournament competitive' },
};

/**
 * Computes a Commander bracket rating (1-5) for a decklist.
 * `format` gates this to commander/brawl/oathbreaker, matching the deck-detail behavior this was extracted from.
 * `comboCount` should come from combo detection (e.g. /api/deck-wizard/detect-combos) — pass 0 if unknown/not run yet.
 */
export function computeBracketRating(
  cardNames: string[],
  format: string,
  comboCount: number
): BracketRating | null {
  const isCommander = ['commander', 'brawl', 'oathbreaker'].includes((format ?? '').toLowerCase());
  if (!isCommander) return null;

  const gameChangersInDeck = cardNames.filter(n => GAME_CHANGERS.has(n));
  const extraTurnsInDeck = cardNames.filter(n => EXTRA_TURNS.has(n));
  const massLandInDeck = cardNames.filter(n => MASS_LAND_DENIAL.has(n));
  const hasInfiniteCombos = comboCount > 0;
  const gcCount = gameChangersInDeck.length;

  let bracket: 1 | 2 | 3 | 4 | 5;
  const reasons: string[] = [];

  if (gcCount >= 4 || massLandInDeck.length > 0) {
    bracket = 4;
    if (gcCount >= 4) reasons.push(`${gcCount} Game Changers`);
    if (massLandInDeck.length > 0) reasons.push(`Mass land denial (${massLandInDeck[0]})`);
  } else if (gcCount >= 1 || hasInfiniteCombos || extraTurnsInDeck.length > 0) {
    bracket = 3;
    if (gcCount > 0) reasons.push(`${gcCount} Game Changer${gcCount > 1 ? 's' : ''}: ${gameChangersInDeck.slice(0, 2).join(', ')}${gcCount > 2 ? '…' : ''}`);
    if (hasInfiniteCombos) reasons.push(`${comboCount} combo${comboCount > 1 ? 's' : ''} detected`);
    if (extraTurnsInDeck.length > 0) reasons.push(`Extra turns (${extraTurnsInDeck[0]})`);
  } else if (cardNames.length > 0) {
    bracket = 2;
    reasons.push('No Game Changers, no infinite combos');
  } else {
    bracket = 1;
  }

  return { bracket, reasons, gcCount, gameChangersInDeck };
}
