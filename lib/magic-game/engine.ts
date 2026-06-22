/**
 * Magic Game Engine
 * Core game logic and state management
 */

import { generateStarterDeck, findCard } from './cards';
import type { GameState, PlayerState, GameAction, Card, CardInstance } from './types';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create a new player state with a deck
 */
function createPlayerState(deck: Card[]): PlayerState {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  return {
    life: 20,
    library: shuffled,
    hand: [],
    board: [],
    graveyard: [],
    manaPool: 0,
    landsPlayedThisTurn: 0,
  };
}

/**
 * Initialize a new game
 */
export function initializeGame(): GameState {
  const playerDeck = generateStarterDeck();
  const khoaDeck = generateStarterDeck();

  const playerState = createPlayerState(playerDeck);
  const khoaState = createPlayerState(khoaDeck);

  // Draw opening hands (7 cards)
  for (let i = 0; i < 7; i++) {
    drawCard(playerState);
    drawCard(khoaState);
  }

  const game: GameState = {
    playerState,
    khoaState,
    currentPhase: 'draw',
    currentPlayer: 'player',
    turn: 1,
    status: 'playing',
    log: ['Game started. Player has priority.'],
    selectedAttackers: [],
    selectedBlockers: new Map(),
  };

  return game;
}

// ============================================================================
// CORE MECHANICS
// ============================================================================

/**
 * Draw a card from library to hand
 */
export function drawCard(player: PlayerState): boolean {
  if (player.library.length === 0) {
    return false; // Lost (empty library)
  }
  const card = player.library.pop()!;
  player.hand.push({
    ...card,
    instanceId: Math.random().toString(36).substring(7),
  });
  return true;
}

/**
 * Get mana from lands on board
 */
export function refreshMana(player: PlayerState): void {
  let mana = 0;
  for (const card of player.board) {
    if (card.type === 'land') {
      mana += 1;
    }
  }
  player.manaPool = mana;
}

/**
 * Play a land from hand
 */
export function playLand(game: GameState, instanceId: string): boolean {
  const player = game.currentPlayer === 'player' ? game.playerState : game.khoaState;
  const cardIndex = player.hand.findIndex((c) => c.instanceId === instanceId);

  if (cardIndex === -1 || player.hand[cardIndex].type !== 'land') {
    return false;
  }

  if (player.landsPlayedThisTurn >= 1) {
    game.log.push('Already played a land this turn.');
    return false;
  }

  const card = player.hand.splice(cardIndex, 1)[0];
  player.board.push(card);
  player.landsPlayedThisTurn += 1;
  refreshMana(player);

  game.log.push(`${game.currentPlayer} played ${card.name}.`);
  return true;
}

/**
 * Play a creature from hand
 */
export function playCreature(game: GameState, instanceId: string): boolean {
  const player = game.currentPlayer === 'player' ? game.playerState : game.khoaState;
  const cardIndex = player.hand.findIndex((c) => c.instanceId === instanceId);

  if (cardIndex === -1) {
    return false;
  }

  const card = player.hand[cardIndex];
  if (card.type !== 'creature') {
    return false;
  }

  if (player.manaPool < card.manaCost) {
    game.log.push('Not enough mana.');
    return false;
  }

  player.hand.splice(cardIndex, 1);
  player.board.push(card);
  player.manaPool -= card.manaCost;

  game.log.push(`${game.currentPlayer} played ${card.name}.`);
  return true;
}

/**
 * Cast a spell (damage, draw, removal, etc)
 */
export function castSpell(game: GameState, instanceId: string, targetId?: string): boolean {
  const player = game.currentPlayer === 'player' ? game.playerState : game.khoaState;
  const opponent = game.currentPlayer === 'player' ? game.khoaState : game.playerState;
  const cardIndex = player.hand.findIndex((c) => c.instanceId === instanceId);

  if (cardIndex === -1) {
    return false;
  }

  const card = player.hand[cardIndex];
  if (card.type === 'land' || card.type === 'creature') {
    return false;
  }

  if (player.manaPool < card.manaCost) {
    game.log.push('Not enough mana.');
    return false;
  }

  player.hand.splice(cardIndex, 1);
  player.manaPool -= card.manaCost;

  // Resolve spell effect
  if (card.name === 'Shock' || card.name === 'Lightning Bolt') {
    const damage = card.name === 'Shock' ? 2 : 3;
    opponent.life -= damage;
    game.log.push(`${card.name} dealt ${damage} damage to opponent.`);
  } else if (card.name === 'Fireball') {
    opponent.life -= 4;
    game.log.push(`Fireball dealt 4 damage to opponent.`);
  } else if (card.name === 'Ponder' || card.name === 'Divination') {
    const draws = card.name === 'Ponder' ? 1 : 2;
    for (let i = 0; i < draws; i++) {
      drawCard(player);
    }
    game.log.push(`${game.currentPlayer} drew ${draws} card(s).`);
  } else if (card.name === 'Destroy') {
    if (targetId) {
      const targetIndex = opponent.board.findIndex((c) => c.instanceId === targetId && c.type === 'creature');
      if (targetIndex !== -1) {
        const destroyed = opponent.board.splice(targetIndex, 1)[0];
        game.log.push(`Destroyed ${destroyed.name}.`);
      }
    }
  } else if (card.name === 'Bounce') {
    if (targetId) {
      const targetIndex = opponent.board.findIndex((c) => c.instanceId === targetId && c.type === 'creature');
      if (targetIndex !== -1) {
        const bounced = opponent.board.splice(targetIndex, 1)[0];
        opponent.hand.push(bounced);
        game.log.push(`Bounced ${bounced.name} back to hand.`);
      }
    }
  } else if (card.name === 'Gain Life') {
    player.life += 4;
    game.log.push(`${game.currentPlayer} gained 4 life.`);
  }

  return true;
}

// ============================================================================
// COMBAT
// ============================================================================

/**
 * Declare attackers
 */
export function declareAttackers(game: GameState, creatureInstanceIds: string[]): boolean {
  if (game.currentPhase !== 'combat') {
    return false;
  }

  const player = game.currentPlayer === 'player' ? game.playerState : game.khoaState;

  // Validate all creatures are on board and are creatures
  for (const id of creatureInstanceIds) {
    const creature = player.board.find((c) => c.instanceId === id && c.type === 'creature');
    if (!creature) {
      return false;
    }
  }

  game.selectedAttackers = creatureInstanceIds;
  game.log.push(`${game.currentPlayer} declared ${creatureInstanceIds.length} attacker(s).`);
  return true;
}

/**
 * Declare a blocker for an attacker
 */
export function declareBlocker(game: GameState, attackerId: string, blockerId: string): boolean {
  const opponent = game.currentPlayer === 'player' ? game.khoaState : game.playerState;

  const blocker = opponent.board.find((c) => c.instanceId === blockerId && c.type === 'creature');
  if (!blocker) {
    return false;
  }

  game.selectedBlockers.set(attackerId, blockerId);
  return true;
}

/**
 * Resolve combat
 */
export function resolveCombat(game: GameState): void {
  const attacker = game.currentPlayer === 'player' ? game.playerState : game.khoaState;
  const defender = game.currentPlayer === 'player' ? game.khoaState : game.playerState;

  for (const attackerId of game.selectedAttackers) {
    const attackerCard = attacker.board.find((c) => c.instanceId === attackerId);
    if (!attackerCard || !attackerCard.power) continue;

    const blockerId = game.selectedBlockers.get(attackerId);
    if (blockerId) {
      // Blocked
      const blockerCard = defender.board.find((c) => c.instanceId === blockerId);
      if (blockerCard && blockerCard.toughness) {
        // Deal damage
        if (attackerCard.power) {
          blockerCard.damage = (blockerCard.damage || 0) + attackerCard.power;
          if (blockerCard.damage >= blockerCard.toughness) {
            const idx = defender.board.findIndex((c) => c.instanceId === blockerId);
            defender.board.splice(idx, 1);
            game.log.push(`${blockerCard.name} was destroyed.`);
          }
        }
      }
    } else {
      // Unblocked - deals damage to player
      defender.life -= attackerCard.power;
      game.log.push(`${attackerCard.name} dealt ${attackerCard.power} damage to opponent.`);
    }
  }

  game.selectedAttackers = [];
  game.selectedBlockers.clear();
}

// ============================================================================
// TURN MANAGEMENT
// ============================================================================

/**
 * End current phase and move to next
 */
export function endPhase(game: GameState): void {
  const phases: Array<typeof game.currentPhase> = ['draw', 'main1', 'combat', 'main2', 'end'];
  const currentIndex = phases.indexOf(game.currentPhase);
  const nextIndex = (currentIndex + 1) % phases.length;

  game.currentPhase = phases[nextIndex];

  if (game.currentPhase === 'draw') {
    // Next turn
    game.turn += 1;
    game.currentPlayer = game.currentPlayer === 'player' ? 'khoa' : 'player';

    const player = game.currentPlayer === 'player' ? game.playerState : game.khoaState;
    drawCard(player);
    refreshMana(player);
    player.landsPlayedThisTurn = 0;

    game.log.push(`--- Turn ${game.turn}: ${game.currentPlayer}'s turn ---`);
  }
}

/**
 * Check win conditions
 */
export function checkWinConditions(game: GameState): void {
  if (game.playerState.life <= 0) {
    game.status = 'khoaWon';
    game.log.push('Khoa wins!');
  } else if (game.khoaState.life <= 0) {
    game.status = 'playerWon';
    game.log.push('You win!');
  }
}

/**
 * Apply an action to the game
 */
export function applyAction(game: GameState, action: GameAction): void {
  if (game.status !== 'playing') return;

  switch (action.type) {
    case 'play-land':
      playLand(game, action.cardInstanceId);
      break;
    case 'play-creature':
      playCreature(game, action.cardInstanceId);
      break;
    case 'play-spell':
      castSpell(game, action.cardInstanceId, action.targetId);
      break;
    case 'attack':
      declareAttackers(game, action.creatureInstanceIds);
      break;
    case 'block':
      declareBlocker(game, action.attackerId, action.blockerId);
      break;
    case 'pass':
      endPhase(game);
      break;
  }

  checkWinConditions(game);
}
