/**
 * Commander Game Engine
 * Real Magic rules with Scryfall cards
 */

import { parseMana } from './scryfall-integration';
import type { CommanderGameState, CommanderPlayerState, GameAction, ScryfallCard, GameCard } from './commander-types';

/**
 * Create a player state
 */
async function createPlayerState(userId: string, commanderName: string): Promise<CommanderPlayerState | null> {
  // Fetch deck from server endpoint (avoids rate limiting on client)
  const deckRes = await fetch('/api/magic-game/generate-deck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commanderName })
  });

  if (!deckRes.ok) return null;

  const { deck } = await deckRes.json();
  if (!deck || deck.length === 0) return null;

  const commander = deck[0];
  // Remove commander from library, leaving 99 other cards
  const library = deck.slice(1).sort(() => Math.random() - 0.5);

  return {
    userId,
    life: 40, // Commander starting life
    commander,
    commanderDamage: 0,
    library,
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    manaPool: 0,
  };
}

/**
 * Initialize a new Commander game
 */
export async function initializeCommanderGame(playerCommander: string): Promise<CommanderGameState | null> {
  const playerState = await createPlayerState('player', playerCommander);
  const shahrazadState = await createPlayerState('shahrazad', 'Omnath, Locus of Creation'); // Default AI commander

  if (!playerState || !shahrazadState) return null;

  // Draw opening hands (7 cards)
  for (let i = 0; i < 7; i++) {
    drawCard(playerState);
    drawCard(shahrazadState);
  }

  const game: CommanderGameState = {
    playerState,
    shahrazadState,
    currentPhase: 'untap',
    currentPlayer: 'player',
    turn: 1,
    status: 'mulligan',
    log: ['Choose to keep or mulligan your opening hand.'],
    stack: [],
    mulligans: { player: 0, shahrazad: 0 },
  };

  return game;
}

/**
 * Draw a card from library
 */
export function drawCard(player: CommanderPlayerState): boolean {
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
 * Untap all permanents
 */
export function untapAll(player: CommanderPlayerState): void {
  for (const card of player.battlefield) {
    card.tapped = false;
  }
}

/**
 * Refresh mana pool (sum of untapped lands)
 */
export function refreshMana(player: CommanderPlayerState): void {
  let mana = 0;

  for (const card of player.battlefield) {
    if (!card.tapped && card.type_line?.toLowerCase().includes('land')) {
      mana += 1;
    }
  }

  player.manaPool = mana;
}

/**
 * Play a land
 */
export function playLand(game: CommanderGameState, instanceId: string): boolean {
  const player = game.currentPlayer === 'player' ? game.playerState : game.shahrazadState;
  const cardIndex = player.hand.findIndex((c) => c.instanceId === instanceId);

  if (cardIndex === -1) return false;

  const card = player.hand[cardIndex];
  if (!card.type_line?.toLowerCase().includes('land')) return false;

  // Check if already played a land this turn (simplified: only 1 land per turn)
  const landsPlayedThisTurn = player.battlefield.filter(
    (c) => c.type_line?.toLowerCase().includes('land') && !c.tapped
  ).length;
  if (landsPlayedThisTurn >= 1) return false;

  player.hand.splice(cardIndex, 1);
  player.battlefield.push(card);
  refreshMana(player);

  game.log.push(`${game.currentPlayer} played ${card.name}.`);
  return true;
}

/**
 * Cast a spell
 */
export function castSpell(game: CommanderGameState, instanceId: string): boolean {
  const player = game.currentPlayer === 'player' ? game.playerState : game.shahrazadState;
  const opponent = game.currentPlayer === 'player' ? game.shahrazadState : game.playerState;
  const cardIndex = player.hand.findIndex((c) => c.instanceId === instanceId);

  if (cardIndex === -1) return false;

  const card = player.hand[cardIndex];
  const cost = parseMana(card.mana_cost);

  if (player.manaPool < cost) {
    game.log.push('Not enough mana.');
    return false;
  }

  player.hand.splice(cardIndex, 1);
  player.manaPool -= cost;

  // Resolve spell (simplified)
  if (card.type_line?.toLowerCase().includes('creature')) {
    player.battlefield.push(card);
    game.log.push(`${game.currentPlayer} cast ${card.name}.`);
  } else if (card.type_line?.toLowerCase().includes('instant') || card.type_line?.toLowerCase().includes('sorcery')) {
    // Simplified: instant/sorcery deals 3 damage
    opponent.life -= 3;
    player.graveyard.push(card);
    game.log.push(`${card.name} dealt 3 damage to opponent.`);
  } else {
    player.battlefield.push(card);
    game.log.push(`${game.currentPlayer} cast ${card.name}.`);
  }

  return true;
}

/**
 * Declare attackers
 */
export function declareAttackers(game: CommanderGameState, creatureInstanceIds: string[]): boolean {
  const player = game.currentPlayer === 'player' ? game.playerState : game.shahrazadState;

  for (const id of creatureInstanceIds) {
    const creature = player.battlefield.find((c) => c.instanceId === id && c.type_line?.toLowerCase().includes('creature'));
    if (!creature) return false;
  }

  // Store attackers in stack temporarily
  game.stack = creatureInstanceIds.map((id) =>
    player.battlefield.find((c) => c.instanceId === id)!
  );

  game.log.push(`${game.currentPlayer} declared ${creatureInstanceIds.length} attacker(s).`);
  return true;
}

/**
 * Resolve combat (simplified)
 */
export function resolveCombat(game: CommanderGameState): void {
  const attacker = game.currentPlayer === 'player' ? game.playerState : game.shahrazadState;
  const defender = game.currentPlayer === 'player' ? game.shahrazadState : game.playerState;

  let totalDamage = 0;

  for (const attackingCard of game.stack) {
    const power = parseInt(attackingCard.power || '0');
    totalDamage += power;
  }

  defender.life -= totalDamage;

  if (totalDamage > 0) {
    game.log.push(`Combat damage: ${totalDamage} to opponent.`);
  }

  game.stack = [];
}

/**
 * End current phase and move to next
 */
export function endPhase(game: CommanderGameState): void {
  const phases: Array<typeof game.currentPhase> = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'ending'];
  const currentIndex = phases.indexOf(game.currentPhase);
  const nextIndex = (currentIndex + 1) % phases.length;

  game.currentPhase = phases[nextIndex];

  // Transition to next turn
  if (game.currentPhase === 'untap') {
    game.turn += 1;
    game.currentPlayer = game.currentPlayer === 'player' ? 'shahrazad' : 'player';

    const player = game.currentPlayer === 'player' ? game.playerState : game.shahrazadState;

    // Untap phase
    untapAll(player);

    // Draw phase
    if (!drawCard(player)) {
      game.status = game.currentPlayer === 'player' ? 'shahrazadWon' : 'playerWon';
      game.log.push(`${game.currentPlayer === 'player' ? 'You' : 'Shahrazad'} ran out of cards!`);
      return;
    }

    refreshMana(player);
    game.log.push(`--- Turn ${game.turn}: ${game.currentPlayer}'s turn ---`);
  }

  // Check win conditions
  if (game.playerState.life <= 0) {
    game.status = 'shahrazadWon';
    game.log.push('Shahrazad wins!');
  } else if (game.shahrazadState.life <= 0) {
    game.status = 'playerWon';
    game.log.push('You win!');
  }
}

/**
 * Mulligan: Draw 7 cards and put back one
 */
export function mulligan(game: CommanderGameState, playerSide: 'player' | 'shahrazad'): void {
  const player = playerSide === 'player' ? game.playerState : game.shahrazadState;

  // Clear hand (cards go back to library)
  player.hand = [];

  // Increment mulligan count
  game.mulligans[playerSide]++;

  // Draw 7 cards
  for (let i = 0; i < 7; i++) {
    drawCard(player);
  }

  game.log.push(`${playerSide} took mulligan #${game.mulligans[playerSide]} (drew to 7)`);
}

/**
 * Keep current hand - start the game
 */
export function keepHand(game: CommanderGameState): void {
  if (game.status !== 'mulligan') return;

  // Both players have made their mulligan decision, start the game
  game.status = 'playing';
  game.currentPlayer = 'player'; // Player goes first
  game.currentPhase = 'untap';
  game.log.push('Game started! Player has priority.');
}

/**
 * Apply an action to the game
 */
export function applyAction(game: CommanderGameState, action: GameAction): void {
  if (game.status !== 'playing') return;

  switch (action.type) {
    case 'play-land':
      playLand(game, action.cardInstanceId);
      break;
    case 'cast-spell':
      castSpell(game, action.cardInstanceId);
      break;
    case 'attack':
      declareAttackers(game, action.creatureInstanceIds);
      break;
    case 'end-phase':
      endPhase(game);
      break;
  }
}
