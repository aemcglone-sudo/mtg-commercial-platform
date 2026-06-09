/**
 * Magic Game Engine - Casual Simplified
 * Types and interfaces for game state
 */

// ============================================================================
// CARD TYPES
// ============================================================================

export type CardType = 'land' | 'creature' | 'sorcery' | 'instant' | 'enchantment';
export type Color = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'; // White, Blue, Black, Red, Green, Colorless

export interface Card {
  id: string;
  name: string;
  type: CardType;
  colors: Color[];
  manaCost: number; // Simplified: just total mana cost
  text: string; // Card effect description
  power?: number; // For creatures
  toughness?: number; // For creatures
  imageUrl?: string;
}

export interface CardInstance extends Card {
  instanceId: string; // Unique per card in hand/board
  damage?: number; // Damage on creatures
}

// ============================================================================
// GAME STATE
// ============================================================================

export type GamePhase = 'draw' | 'main1' | 'combat' | 'main2' | 'end';
export type GameStatus = 'playing' | 'playerWon' | 'shahrazadWon';

export interface PlayerState {
  life: number;
  library: Card[]; // Deck (shuffled)
  hand: CardInstance[];
  board: CardInstance[]; // Creatures/permanents on field
  graveyard: CardInstance[];
  manaPool: number; // Current available mana
  landsPlayedThisTurn: number;
}

export interface GameState {
  playerState: PlayerState;
  shahrazadState: PlayerState;
  currentPhase: GamePhase;
  currentPlayer: 'player' | 'shahrazad';
  turn: number;
  status: GameStatus;
  log: string[]; // Game log for UI
  selectedAttackers: string[]; // Instance IDs of creatures attacking
  selectedBlockers: Map<string, string>; // attacker ID -> blocker ID
}

// ============================================================================
// ACTIONS
// ============================================================================

export type GameAction =
  | { type: 'play-land'; cardInstanceId: string }
  | { type: 'play-creature'; cardInstanceId: string }
  | { type: 'play-spell'; cardInstanceId: string; targetId?: string }
  | { type: 'attack'; creatureInstanceIds: string[] }
  | { type: 'block'; attackerId: string; blockerId: string }
  | { type: 'pass' }
  | { type: 'mulligan' };

// ============================================================================
// COMBAT
// ============================================================================

export interface CombatAction {
  attackerId: string;
  blockerId?: string;
}
