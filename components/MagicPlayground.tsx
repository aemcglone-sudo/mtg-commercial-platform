'use client';

import { useState, useEffect } from 'react';
import { initializeGame, applyAction, endPhase } from '@/lib/magic-game/engine';
import { executeShaharazadTurn } from '@/lib/magic-game/ai';
import type { GameState } from '@/lib/magic-game/types';

export default function MagicPlayground() {
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedHand, setSelectedHand] = useState<string | null>(null);

  useEffect(() => {
    // Initialize game on mount
    const newGame = initializeGame();
    setGame(newGame);
  }, []);

  useEffect(() => {
    if (!game || game.status !== 'playing' || game.currentPlayer !== 'khoa') {
      return;
    }

    // Khoa's turn
    const timer = setTimeout(() => {
      const updatedGame = { ...game };
      executeShaharazadTurn(updatedGame);
      setGame(updatedGame);
    }, 1000);

    return () => clearTimeout(timer);
  }, [game]);

  if (!game) {
    return <div className="p-4 text-center">Loading game...</div>;
  }

  const isPlayerTurn = game.currentPlayer === 'player';
  const canPlayLand = game.currentPhase === 'main1' || game.currentPhase === 'main2';

  const handlePlayCard = (instanceId: string, type: string) => {
    const updatedGame = { ...game };

    if (type === 'land') {
      applyAction(updatedGame, { type: 'play-land', cardInstanceId: instanceId });
    } else if (type === 'creature') {
      applyAction(updatedGame, { type: 'play-creature', cardInstanceId: instanceId });
    } else {
      applyAction(updatedGame, { type: 'play-spell', cardInstanceId: instanceId });
    }

    setGame(updatedGame);
    setSelectedHand(null);
  };

  const handleEndPhase = () => {
    const updatedGame = { ...game };
    endPhase(updatedGame);
    setGame(updatedGame);
  };

  return (
    <div className="h-screen bg-gradient-to-b from-green-900 to-green-950 text-white p-4 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">🎴 Magic: Casual Match</h1>
        <div className="text-sm text-gray-300">Turn {game.turn} • Phase: {game.currentPhase}</div>
      </div>

      {/* Game status */}
      {game.status !== 'playing' && (
        <div className="text-center mb-4 p-4 bg-yellow-900 rounded-lg text-xl font-bold">
          {game.status === 'playerWon' ? '🎉 You Win!' : '😢 Khoa Wins!'}
        </div>
      )}

      {/* Opponent Board */}
      <div className="flex-1 mb-4 p-4 bg-black/30 rounded-lg border border-yellow-700">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Khoa</h2>
          <div className="text-2xl font-bold text-red-400">❤️ {game.khoaState.life}</div>
        </div>

        {/* Khoa's creatures */}
        <div className="flex gap-2 flex-wrap">
          {game.khoaState.board
            .filter((c) => c.type === 'creature')
            .map((creature) => (
              <div
                key={creature.instanceId}
                className="bg-red-900 border border-red-400 p-2 rounded text-sm min-w-20 text-center"
              >
                <div className="font-bold">{creature.name}</div>
                <div className="text-xs">{creature.power}/{creature.toughness}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Battlefield */}
      <div className="flex-1 mb-4 p-4 bg-black/20 rounded-lg border border-gray-600 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-2">Battlefield</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Player's board */}
          <div>
            <h3 className="text-sm font-semibold text-blue-300 mb-2">Your Creatures:</h3>
            <div className="flex flex-col gap-2">
              {game.playerState.board
                .filter((c) => c.type === 'creature')
                .map((creature) => (
                  <div key={creature.instanceId} className="bg-blue-900 border border-blue-400 p-2 rounded text-sm">
                    <div className="font-bold">{creature.name}</div>
                    <div className="text-xs">{creature.power}/{creature.toughness}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Lands */}
          <div>
            <h3 className="text-sm font-semibold text-yellow-300 mb-2">Lands:</h3>
            <div className="flex flex-col gap-2">
              <div className="bg-yellow-900 border border-yellow-500 p-2 rounded text-sm">
                <div>Your Lands: {game.playerState.board.filter((c) => c.type === 'land').length}</div>
                <div className="text-xs">Mana: {game.playerState.manaPool}</div>
              </div>
              <div className="bg-red-900 border border-red-500 p-2 rounded text-sm">
                <div>Khoa Lands: {game.khoaState.board.filter((c) => c.type === 'land').length}</div>
                <div className="text-xs">Mana: {game.khoaState.manaPool}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Board */}
      <div className="mb-4 p-4 bg-black/30 rounded-lg border border-blue-700">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">You</h2>
          <div className="text-2xl font-bold text-blue-400">❤️ {game.playerState.life}</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {game.playerState.board
            .filter((c) => c.type === 'creature')
            .map((creature) => (
              <div
                key={creature.instanceId}
                className="bg-blue-900 border border-blue-400 p-2 rounded text-sm min-w-20 text-center"
              >
                <div className="font-bold text-sm">{creature.name}</div>
                <div className="text-xs">{creature.power}/{creature.toughness}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Hand */}
      <div className="p-4 bg-black/40 rounded-lg border border-gray-500">
        <div className="text-sm text-gray-300 mb-2">
          Hand ({game.playerState.hand.length}) • Mana: {game.playerState.manaPool} • Phase: {game.currentPhase}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {game.playerState.hand.map((card) => (
            <button
              key={card.instanceId}
              onClick={() => {
                if (canPlayLand && card.type === 'land') {
                  handlePlayCard(card.instanceId, 'land');
                } else if (game.currentPhase === 'main1' || game.currentPhase === 'main2') {
                  if (card.type === 'creature' && game.playerState.manaPool >= card.manaCost) {
                    handlePlayCard(card.instanceId, 'creature');
                  } else if ((card.type === 'sorcery' || card.type === 'instant') && game.playerState.manaPool >= card.manaCost) {
                    handlePlayCard(card.instanceId, 'spell');
                  }
                }
              }}
              disabled={!isPlayerTurn}
              className={`px-3 py-2 rounded text-sm min-w-max whitespace-nowrap ${
                card.type === 'land'
                  ? 'bg-yellow-700 hover:bg-yellow-600'
                  : card.type === 'creature'
                    ? 'bg-blue-700 hover:bg-blue-600'
                    : 'bg-purple-700 hover:bg-purple-600'
              } ${!isPlayerTurn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {card.name} ({card.manaCost})
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleEndPhase}
          disabled={!isPlayerTurn || game.status !== 'playing'}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded font-semibold"
        >
          Pass Turn ({game.currentPhase})
        </button>
        <button
          onClick={() => {
            const newGame = initializeGame();
            setGame(newGame);
          }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold"
        >
          New Game
        </button>
      </div>

      {/* Game Log */}
      <div className="mt-4 text-xs bg-black/50 p-2 rounded max-h-24 overflow-y-auto text-gray-300">
        {game.log.slice(-8).map((entry, i) => (
          <div key={i}>{entry}</div>
        ))}
      </div>
    </div>
  );
}
