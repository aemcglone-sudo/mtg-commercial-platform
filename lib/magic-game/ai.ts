/**
 * Khoa AI
 * Decision-making for the opponent
 */

import type { GameState, CardInstance } from './types';

// ============================================================================
// AI DECISION MAKING
// ============================================================================

/**
 * Calculate board value (sum of creature power)
 */
function calculateBoardValue(creatures: CardInstance[]): number {
  return creatures.reduce((sum, c) => sum + (c.power || 0), 0);
}

/**
 * Decide which lands to play
 */
export function aiPlayLands(game: GameState): string[] {
  const khoa = game.khoaState;
  const landCards = khoa.hand.filter((c) => c.type === 'land');

  // Play lands if we have played fewer than 1 land this turn
  if (khoa.landsPlayedThisTurn < 1 && landCards.length > 0) {
    return [landCards[0].instanceId];
  }

  return [];
}

/**
 * Decide which creatures to play
 */
export function aiPlayCreatures(game: GameState): string[] {
  const khoa = game.khoaState;
  const playable = khoa.hand
    .filter((c) => c.type === 'creature' && khoa.manaPool >= c.manaCost)
    .sort((a, b) => (a.manaCost || 0) - (b.manaCost || 0)); // Play cheapest first

  const toPlay: string[] = [];
  for (const creature of playable) {
    if (khoa.manaPool >= creature.manaCost) {
      toPlay.push(creature.instanceId);
      khoa.manaPool -= creature.manaCost;
    }
  }

  return toPlay;
}

/**
 * Decide which spells to play
 */
export function aiPlaySpells(game: GameState): string[] {
  const khoa = game.khoaState;
  const player = game.playerState;

  const spells = khoa.hand
    .filter((c) => (c.type === 'sorcery' || c.type === 'instant') && khoa.manaPool >= c.manaCost)
    .sort((a, b) => (b.manaCost || 0) - (a.manaCost || 0)); // Play expensive first (high impact)

  const toPlay: string[] = [];

  for (const spell of spells) {
    if (khoa.manaPool < spell.manaCost) continue;

    // Prioritize damage spells if opponent is low
    if (player.life <= 8 && ['Shock', 'Lightning Bolt', 'Fireball'].includes(spell.name)) {
      toPlay.push(spell.instanceId);
      khoa.manaPool -= spell.manaCost;
    }
    // Play draw spells if we're running low on cards
    else if (khoa.hand.length <= 3 && ['Ponder', 'Divination'].includes(spell.name)) {
      toPlay.push(spell.instanceId);
      khoa.manaPool -= spell.manaCost;
    }
    // Play removal if opponent has strong creatures
    else if (['Destroy', 'Bounce'].includes(spell.name) && player.board.length > 2) {
      toPlay.push(spell.instanceId);
      khoa.manaPool -= spell.manaCost;
    }
  }

  return toPlay;
}

/**
 * Decide which creatures to attack with
 */
export function aiSelectAttackers(game: GameState): string[] {
  const khoa = game.khoaState;
  const player = game.playerState;

  const creatures = khoa.board.filter((c) => c.type === 'creature');

  // Simple AI: attack if we have board advantage
  const ourPower = calculateBoardValue(creatures);
  const theirPower = calculateBoardValue(player.board.filter((c) => c.type === 'creature'));

  if (ourPower > theirPower || player.life <= 8) {
    // Attack with all creatures
    return creatures.map((c) => c.instanceId);
  }

  // Otherwise, attack with small creatures
  return creatures
    .filter((c) => (c.power || 0) <= 2)
    .map((c) => c.instanceId);
}

/**
 * Decide which creatures to block with
 */
export function aiSelectBlockers(
  game: GameState,
  attackerIds: string[]
): Map<string, string> {
  const khoa = game.khoaState;
  const player = game.playerState;

  const blockers = new Map<string, string>();
  const availableBlockers = [...player.board.filter((c) => c.type === 'creature')];

  for (const attackerId of attackerIds) {
    const attacker = khoa.board.find((c) => c.instanceId === attackerId);
    if (!attacker) continue;

    // Find a blocker
    const goodBlocker = availableBlockers.find((c) => (c.toughness || 0) >= (attacker.power || 0));
    const anyBlocker = availableBlockers[0];
    const blocker = goodBlocker || anyBlocker;

    if (blocker) {
      blockers.set(attackerId, blocker.instanceId);
      availableBlockers.splice(availableBlockers.indexOf(blocker), 1);
    }
  }

  return blockers;
}

/**
 * Execute Khoa's turn
 */
export function executeShaharazadTurn(game: GameState): void {
  if (game.currentPlayer !== 'khoa' || game.status !== 'playing') {
    return;
  }

  game.log.push('Khoa is thinking...');

  // Main phase
  if (game.currentPhase === 'main1') {
    // Play lands
    const landsToPlay = aiPlayLands(game);
    for (const landId of landsToPlay) {
      const { playLand } = require('./engine');
      playLand(game, landId);
    }

    // Play creatures
    const creaturesToPlay = aiPlayCreatures(game);
    const { playCreature } = require('./engine');
    for (const creatureId of creaturesToPlay) {
      playCreature(game, creatureId);
    }

    // Play spells
    const spellsToPlay = aiPlaySpells(game);
    const { castSpell } = require('./engine');
    for (const spellId of spellsToPlay) {
      castSpell(game, spellId);
    }

    // Pass to combat
    setTimeout(() => {
      const { endPhase } = require('./engine');
      endPhase(game);
    }, 500);
  }
  // Combat phase
  else if (game.currentPhase === 'combat') {
    const attackers = aiSelectAttackers(game);
    const { declareAttackers } = require('./engine');
    declareAttackers(game, attackers);

    // Opponent will block (player input), so we wait
  }
  // End phase
  else if (game.currentPhase === 'end') {
    const { endPhase } = require('./engine');
    endPhase(game);
  }
}
