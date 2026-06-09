/**
 * Simplified Card Database
 * ~50 cards for casual Magic gameplay
 */

import type { Card, Color } from './types';

// ============================================================================
// LANDS
// ============================================================================

const LANDS: Card[] = [
  { id: 'plains', name: 'Plains', type: 'land', colors: ['W'], manaCost: 0, text: 'Tap: Add W mana' },
  { id: 'island', name: 'Island', type: 'land', colors: ['U'], manaCost: 0, text: 'Tap: Add U mana' },
  { id: 'swamp', name: 'Swamp', type: 'land', colors: ['B'], manaCost: 0, text: 'Tap: Add B mana' },
  { id: 'mountain', name: 'Mountain', type: 'land', colors: ['R'], manaCost: 0, text: 'Tap: Add R mana' },
  { id: 'forest', name: 'Forest', type: 'land', colors: ['G'], manaCost: 0, text: 'Tap: Add G mana' },
];

// ============================================================================
// CREATURES
// ============================================================================

const CREATURES: Card[] = [
  // White
  { id: 'soldier', name: 'Soldier', type: 'creature', colors: ['W'], manaCost: 1, text: '', power: 1, toughness: 1 },
  { id: 'knight', name: 'Knight', type: 'creature', colors: ['W'], manaCost: 2, text: '', power: 2, toughness: 2 },
  { id: 'angel', name: 'Angel', type: 'creature', colors: ['W'], manaCost: 4, text: 'Flying', power: 3, toughness: 4 },

  // Blue
  { id: 'wizard', name: 'Wizard', type: 'creature', colors: ['U'], manaCost: 1, text: '', power: 1, toughness: 1 },
  { id: 'flying-drake', name: 'Flying Drake', type: 'creature', colors: ['U'], manaCost: 2, text: 'Flying', power: 2, toughness: 2 },
  { id: 'sphinx', name: 'Sphinx', type: 'creature', colors: ['U'], manaCost: 4, text: 'Flying', power: 4, toughness: 3 },

  // Black
  { id: 'skeleton', name: 'Skeleton', type: 'creature', colors: ['B'], manaCost: 1, text: '', power: 1, toughness: 1 },
  { id: 'zombie', name: 'Zombie', type: 'creature', colors: ['B'], manaCost: 2, text: '', power: 2, toughness: 2 },
  { id: 'demon', name: 'Demon', type: 'creature', colors: ['B'], manaCost: 4, text: 'Flying', power: 4, toughness: 3 },

  // Red
  { id: 'goblin', name: 'Goblin', type: 'creature', colors: ['R'], manaCost: 1, text: '', power: 1, toughness: 1 },
  { id: 'dragon', name: 'Young Dragon', type: 'creature', colors: ['R'], manaCost: 3, text: 'Flying', power: 2, toughness: 2 },
  { id: 'fire-elemental', name: 'Fire Elemental', type: 'creature', colors: ['R'], manaCost: 4, text: '', power: 4, toughness: 2 },

  // Green
  { id: 'elf', name: 'Elf', type: 'creature', colors: ['G'], manaCost: 1, text: '', power: 1, toughness: 1 },
  { id: 'bear', name: 'Bear', type: 'creature', colors: ['G'], manaCost: 2, text: '', power: 2, toughness: 2 },
  { id: 'hydra', name: 'Hydra', type: 'creature', colors: ['G'], manaCost: 4, text: '', power: 4, toughness: 4 },
];

// ============================================================================
// SPELLS - DAMAGE
// ============================================================================

const DAMAGE_SPELLS: Card[] = [
  { id: 'shock', name: 'Shock', type: 'instant', colors: ['R'], manaCost: 1, text: 'Deal 2 damage to target creature or player' },
  { id: 'bolt', name: 'Lightning Bolt', type: 'instant', colors: ['R'], manaCost: 1, text: 'Deal 3 damage to target creature or player' },
  { id: 'fireball', name: 'Fireball', type: 'sorcery', colors: ['R'], manaCost: 3, text: 'Deal 4 damage to target creature or player' },
];

// ============================================================================
// SPELLS - DRAW
// ============================================================================

const DRAW_SPELLS: Card[] = [
  { id: 'ponder', name: 'Ponder', type: 'sorcery', colors: ['U'], manaCost: 1, text: 'Draw a card' },
  { id: 'divination', name: 'Divination', type: 'sorcery', colors: ['U'], manaCost: 3, text: 'Draw 2 cards' },
];

// ============================================================================
// SPELLS - REMOVAL
// ============================================================================

const REMOVAL_SPELLS: Card[] = [
  { id: 'destroy', name: 'Destroy', type: 'instant', colors: ['B'], manaCost: 2, text: 'Destroy target creature' },
  { id: 'bounce', name: 'Bounce', type: 'instant', colors: ['U'], manaCost: 2, text: 'Return target creature to its owner\'s hand' },
];

// ============================================================================
// SPELLS - OTHER
// ============================================================================

const OTHER_SPELLS: Card[] = [
  { id: 'gain-life', name: 'Gain Life', type: 'sorcery', colors: ['W'], manaCost: 2, text: 'Gain 4 life' },
  { id: 'lords', name: 'Anthem', type: 'enchantment', colors: ['W'], manaCost: 2, text: 'All creatures get +1/+1' },
];

// ============================================================================
// CARD POOL
// ============================================================================

export const ALL_CARDS: Card[] = [
  ...LANDS,
  ...CREATURES,
  ...DAMAGE_SPELLS,
  ...DRAW_SPELLS,
  ...REMOVAL_SPELLS,
  ...OTHER_SPELLS,
];

/**
 * Generate a starter deck (simplified: just pick random cards)
 */
export function generateStarterDeck(): Card[] {
  const deck: Card[] = [];

  // Add lands (24 lands for 60-card deck)
  for (let i = 0; i < 24; i++) {
    deck.push(LANDS[i % LANDS.length]);
  }

  // Add creatures (20)
  for (let i = 0; i < 20; i++) {
    deck.push(CREATURES[i % CREATURES.length]);
  }

  // Add spells (16)
  const spells = [...DAMAGE_SPELLS, ...DRAW_SPELLS, ...REMOVAL_SPELLS, ...OTHER_SPELLS];
  for (let i = 0; i < 16; i++) {
    deck.push(spells[i % spells.length]);
  }

  return deck.sort(() => Math.random() - 0.5); // Shuffle
}

/**
 * Find a card by ID
 */
export function findCard(cardId: string): Card | undefined {
  return ALL_CARDS.find((c) => c.id === cardId);
}
