/**
 * Commander Deck Synergy Analysis
 * Builds cohesive decks where cards synergize with the commander
 */

import type { ScryfallCard } from './commander-types';

export interface CommanderStrategy {
  primary: string; // e.g., "card draw", "creature tokens", "artifacts matter"
  secondary?: string[];
  weaknesses: string[]; // e.g., ["needs ramp", "vulnerable to removal", "needs card draw"]
}

/**
 * Analyze a commander's core strategy and weaknesses
 */
export function analyzeCommanderStrategy(commander: ScryfallCard): CommanderStrategy {
  const text = (commander.oracle_text || '').toLowerCase();
  const typeLine = (commander.type_line || '').toLowerCase();

  const weaknesses: string[] = [];
  const secondaryStrategies: string[] = [];

  // Determine primary strategy
  let primary = 'general';

  if (text.includes('draw')) {
    primary = 'card draw';
  } else if (text.includes('token') || text.includes('create')) {
    primary = 'token generation';
  } else if (text.includes('sacrifice') || text.includes('etb')) {
    primary = 'creatures and enter-the-battlefield effects';
  } else if (text.includes('enchantment')) {
    primary = 'enchantments matter';
  } else if (text.includes('artifact')) {
    primary = 'artifacts matter';
  } else if (text.includes('graveyard')) {
    primary = 'graveyard strategy';
  } else if (text.includes('mill') || text.includes('exile')) {
    primary = 'mill/exile effects';
  } else if (text.includes('combat') || text.includes('attack')) {
    primary = 'combat-focused aggression';
  } else if (text.includes('tap')) {
    primary = 'tap/untap effects';
  } else if (typeLine.includes('creature')) {
    primary = 'creature-based strategy';
  }

  // Detect secondary strategies
  if (text.includes('ramp') || text.includes('mana')) secondaryStrategies.push('ramp');
  if (text.includes('protection') || text.includes('indestructible')) secondaryStrategies.push('protection');
  if (text.includes('tutor') || text.includes('search')) secondaryStrategies.push('tutors');
  if (text.includes('spell') && text.includes('cast')) secondaryStrategies.push('spell matters');

  // Identify weaknesses based on what commander LACKS
  if (!text.includes('draw')) weaknesses.push('needs card draw');
  if (!text.includes('ramp') && !text.includes('mana')) weaknesses.push('needs ramp/acceleration');
  if (!text.includes('protection') && !text.includes('shroud') && !text.includes('hexproof'))
    weaknesses.push('vulnerable to removal');
  if (text.includes('symmetrical')) weaknesses.push('hurts us too - need asymmetrical payoffs');

  return { primary, secondary: secondaryStrategies, weaknesses };
}

/**
 * Calculate synergy score between commander and a card
 */
export function calculateSynergy(
  card: ScryfallCard,
  commander: ScryfallCard,
  strategy: CommanderStrategy
): number {
  let score = 0;
  const cardText = (card.oracle_text || '').toLowerCase();
  const commanderText = (commander.oracle_text || '').toLowerCase();

  // Perfect synergies
  if (commanderText.includes('sacrifice') && cardText.includes('sacrifice')) score += 30;
  if (commanderText.includes('token') && cardText.includes('token')) score += 25;
  if (commanderText.includes('etb') && cardText.includes('enter')) score += 25;
  if (commanderText.includes('draw') && cardText.includes('draw')) score += 20;
  if (commanderText.includes('enchantment') && cardText.includes('enchantment')) score += 20;
  if (commanderText.includes('artifact') && cardText.includes('artifact')) score += 20;
  if (commanderText.includes('graveyard') && cardText.includes('graveyard')) score += 20;

  // Strategy-specific synergies
  if (strategy.primary === 'card draw' && cardText.includes('draw')) score += 15;
  if (strategy.primary === 'token generation' && cardText.includes('token')) score += 15;
  if (strategy.primary === 'combat-focused aggression' && cardText.includes('double strike'))
    score += 15;
  if (strategy.primary === 'creatures and enter-the-battlefield effects' && cardText.includes('enter'))
    score += 15;

  // Weakness mitigation
  if (strategy.weaknesses.includes('needs card draw') && cardText.includes('draw')) score += 20;
  if (strategy.weaknesses.includes('needs ramp/acceleration') && cardText.includes('mana')) score += 15;
  if (strategy.weaknesses.includes('vulnerable to removal') && cardText.includes('protection'))
    score += 15;

  // Cost reduction synergies
  if (commanderText.includes('cost') && cardText.includes('cost')) score += 10;

  // Creature synergies
  if (strategy.primary.includes('creature') && card.type_line?.includes('Creature')) score += 5;

  // Color identity perfect match bonus
  if (
    card.color_identity &&
    commander.color_identity &&
    card.color_identity.length === commander.color_identity.length &&
    card.color_identity.every(c => commander.color_identity.includes(c))
  ) {
    score += 3; // Exact color match
  }

  return Math.max(0, score);
}

/**
 * Rank cards by synergy with commander
 */
export function rankCardsBySynergy(
  cards: ScryfallCard[],
  commander: ScryfallCard,
  strategy: CommanderStrategy
): ScryfallCard[] {
  const scored = cards.map(card => ({
    card,
    synergy: calculateSynergy(card, commander, strategy)
  }));

  return scored.sort((a, b) => b.synergy - a.synergy).map(s => s.card);
}

/**
 * Get synergy explanation for a card with the commander
 */
export function getSynergyExplanation(
  card: ScryfallCard,
  commander: ScryfallCard,
  strategy: CommanderStrategy
): string {
  const commanderText = (commander.oracle_text || '').toLowerCase();
  const cardText = (card.oracle_text || '').toLowerCase();

  if (commanderText.includes('sacrifice') && cardText.includes('sacrifice'))
    return 'Works with sacrifice theme';
  if (commanderText.includes('token') && cardText.includes('token')) return 'Creates/uses tokens';
  if (commanderText.includes('etb') && cardText.includes('enter')) return 'Triggers with ETB effects';
  if (strategy.weaknesses.includes('needs card draw') && cardText.includes('draw'))
    return 'Provides needed card draw';
  if (strategy.weaknesses.includes('needs ramp/acceleration') && cardText.includes('mana'))
    return 'Provides needed ramp';

  return 'Synergistic with deck';
}
