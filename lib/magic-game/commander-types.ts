/**
 * Commander Format - Real Magic Game
 * Uses actual Scryfall cards
 */

export type GamePhase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'ending';

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  power?: string;
  toughness?: string;
  image_uris?: { normal: string };
  colors: string[];
  color_identity: string[];
  legalities: Record<string, string>;
  prices?: { usd?: string | null };
  keywords?: string[];
}

export interface GameCard extends ScryfallCard {
  instanceId: string;
  damage?: number;
  tapped?: boolean;
}

export interface CommanderPlayerState {
  userId: string;
  life: number;
  commander: ScryfallCard;
  commanderDamage: number; // Commander damage tracker
  library: ScryfallCard[];
  hand: GameCard[];
  battlefield: GameCard[];
  graveyard: GameCard[];
  exile: GameCard[];
  manaPool: number;
}

export type GameStatus = 'deck-select' | 'deck-building' | 'mulligan' | 'playing' | 'playerWon' | 'khoaWon' | 'draw';

export interface CommanderGameState {
  playerState: CommanderPlayerState;
  khoaState: CommanderPlayerState;
  currentPhase: GamePhase;
  currentPlayer: 'player' | 'khoa';
  turn: number;
  status: GameStatus;
  log: string[];
  stack: GameCard[]; // Cards/abilities on the stack
  mulligans: { player: number; khoa: number }; // Track mulligans taken
}

export type GameAction =
  | { type: 'select-commander'; commanderName: string }
  | { type: 'start-game' }
  | { type: 'play-land'; cardInstanceId: string }
  | { type: 'cast-spell'; cardInstanceId: string; targetId?: string }
  | { type: 'attack'; creatureInstanceIds: string[] }
  | { type: 'block'; attackerId: string; blockerId: string }
  | { type: 'pass-priority' }
  | { type: 'end-phase' };
