'use client';

import { useState, useEffect } from 'react';
import { initializeCommanderGame, applyAction, endPhase, mulligan, keepHand } from '@/lib/magic-game/commander-engine';
import { getCardImageUrl } from '@/lib/magic-game/scryfall-integration';
import type { CommanderGameState, ScryfallCard } from '@/lib/magic-game/commander-types';
import type { CollectionResult } from '@/app/page';
import DeckReview from './DeckReview';

export default function CommanderPlayground() {
  const [game, setGame] = useState<CommanderGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCommander, setSelectedCommander] = useState('');
  const [legendaryCards, setLegendaryCards] = useState<Array<{ name: string; image?: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Array<{ name: string; image?: string }>>([]);
  const [hoveredCardImage, setHoveredCardImage] = useState<{ url: string; x: number; y: number } | null>(null);
  const [generatedDeck, setGeneratedDeck] = useState<ScryfallCard[] | null>(null);
  const [deckCommander, setDeckCommander] = useState<ScryfallCard | null>(null);

  // Load legendary creatures from collection
  useEffect(() => {
    const loadLegendaryCards = async () => {
      try {
        const res = await fetch('/api/collection/saved');
        const collection = (await res.json()) as CollectionResult;

        if (collection?.collectionCards) {
          // Filter for legendary creatures
          const legends = collection.collectionCards
            .filter((card) => card.typeLine?.toLowerCase().includes('legendary') &&
                             card.typeLine?.toLowerCase().includes('creature'))
            .map((card) => ({ name: card.name, image: card.imageUrl || undefined }))
            .sort((a, b) => a.name.localeCompare(b.name));

          setLegendaryCards(legends);
        }
      } catch (err) {
        console.error('Error loading legendary cards:', err);
      }
    };

    loadLegendaryCards();
  }, []);

  const handleStartGame = async (commanderName: string) => {
    setLoading(true);
    try {
      // Generate deck first
      const deckRes = await fetch('/api/magic-game/generate-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commanderName })
      });

      if (!deckRes.ok) {
        alert('Could not find that commander. Try selecting from your collection or typing another name.');
        setLoading(false);
        return;
      }

      const { deck } = await deckRes.json();
      if (!deck || deck.length === 0) {
        alert('Could not generate deck. Please try another commander.');
        setLoading(false);
        return;
      }

      // Commander is first card in deck
      const commander = deck[0];
      setDeckCommander(commander);
      setGeneratedDeck(deck);
      setShowSuggestions(false);
    } catch (err) {
      console.error('Error generating deck:', err);
      alert('Error generating deck. Please try again.');
    }
    setLoading(false);
  };

  const handleInputChange = (value: string) => {
    setSelectedCommander(value);
    setShowSuggestions(true);

    if (value.trim()) {
      // Filter suggestions based on input
      const filtered = legendaryCards.filter((card) =>
        card.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions(legendaryCards);
    }
  };

  const handleEndPhase = () => {
    if (!game) return;
    const updatedGame = { ...game };
    endPhase(updatedGame);
    setGame(updatedGame);
  };

  const handleStartGameFromDeck = async () => {
    if (!deckCommander) return;

    const newGame = await initializeCommanderGame(deckCommander.name);
    if (newGame) {
      setGame(newGame);
      setGeneratedDeck(null);
      setDeckCommander(null);
    } else {
      alert('Could not initialize game. Please try again.');
    }
  };

  // Show deck review when generated
  if (generatedDeck && deckCommander) {
    return (
      <DeckReview
        commander={deckCommander}
        deck={generatedDeck}
        onStartGame={handleStartGameFromDeck}
        onChangeCommander={() => {
          setGeneratedDeck(null);
          setDeckCommander(null);
          setSelectedCommander('');
        }}
      />
    );
  }

  // Commander selection screen
  if (!game) {
    return (
      <div className="h-screen bg-gradient-to-b from-purple-900 to-black text-white p-6 flex flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold">🎴 Commander</h1>
        <p className="text-gray-300 text-lg">Choose your commander to begin</p>

        <div className="w-96 relative">
          <input
            type="text"
            placeholder={legendaryCards.length > 0 ? "Search your legendary creatures..." : "Enter commander name"}
            value={selectedCommander}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleStartGame(selectedCommander);
              }
            }}
            onFocus={() => setShowSuggestions(true)}
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-purple-500 text-white placeholder-gray-500 focus:outline-none focus:border-purple-300"
          />

          {/* Suggestions Dropdown */}
          {showSuggestions && legendaryCards.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-purple-500 rounded-lg max-h-48 overflow-y-auto z-50">
              {(selectedCommander.trim() === '' ? legendaryCards : filteredSuggestions).map((card) => (
                <button
                  key={card.name}
                  onClick={() => {
                    setSelectedCommander(card.name);
                    setShowSuggestions(false);
                    handleStartGame(card.name);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-purple-700 transition-colors text-white flex items-center gap-2"
                >
                  {card.image && (
                    <img src={card.image} alt={card.name} className="w-6 h-8 rounded" />
                  )}
                  <span className="text-sm">{card.name}</span>
                </button>
              ))}
              {selectedCommander.trim() !== '' && filteredSuggestions.length === 0 && (
                <div className="px-4 py-2 text-gray-400 text-sm">
                  No matching commanders in your collection. Click Start Game to search all cards.
                </div>
              )}
            </div>
          )}

          {/* Show collection info */}
          {legendaryCards.length > 0 && !showSuggestions && (
            <p className="text-xs text-gray-500 mt-2">
              💬 {legendaryCards.length} legendary creatures in your collection
            </p>
          )}
        </div>

        <button
          onClick={() => handleStartGame(selectedCommander)}
          disabled={!selectedCommander.trim() || loading}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-bold text-lg"
        >
          {loading ? 'Building Synergistic Deck...' : 'Start Game'}
        </button>

        <div className="text-xs text-gray-400 mt-4 max-w-md text-center space-y-2">
          <p>✨ 100-card singleton deck built from Scryfall</p>
          <p>🎯 Cards chosen for synergy with your commander</p>
          <p>🎨 Matches commander's color identity</p>
          <p>💪 Includes ramp, draw, and protection as needed</p>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const isPlayerTurn = game.currentPlayer === 'player';

  // Mulligan phase
  if (game.status === 'mulligan') {
    return (
      <div className="h-screen bg-gradient-to-b from-green-900 to-green-950 text-white p-6 flex flex-col items-center justify-center gap-6">
        <h2 className="text-3xl font-bold">Opening Hand</h2>
        <p className="text-gray-300 text-lg">Mulligan or keep your opening hand of 7 cards</p>

        <div className="w-full max-w-4xl p-6 bg-black/40 rounded-lg border border-blue-600">
          <div className="text-center mb-4">
            <p className="text-sm text-gray-400">Your hand:</p>
            <div className="flex gap-2 justify-center flex-wrap mt-3">
              {game.playerState.hand.map((card) => (
                <img
                  key={card.instanceId}
                  src={getCardImageUrl(card)}
                  alt={card.name}
                  title={card.name}
                  className="w-20 h-32 rounded border-2 border-blue-400"
                />
              ))}
            </div>
          </div>

          <div className="text-center text-xs text-gray-400 mt-4 mb-6">
            {game.mulligans.player === 0 ? (
              <p>This is your opening hand. Keep or mulligan to 7?</p>
            ) : (
              <p>Mulligan #{game.mulligans.player}. Keep or mulligan again?</p>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                const updatedGame = { ...game };
                keepHand(updatedGame);
                setGame(updatedGame);
              }}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold"
            >
              ✅ Keep Hand
            </button>
            <button
              onClick={() => {
                const updatedGame = { ...game };
                mulligan(updatedGame, 'player');
                setGame(updatedGame);
              }}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold"
            >
              🔄 Mulligan
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            {game.mulligans.player === 0
              ? 'First mulligan: draw 7, keep all'
              : `Mulligan #${game.mulligans.player + 1}: draw 7, put back ${game.mulligans.player + 1}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-b from-green-900 to-green-950 text-white p-3 overflow-hidden flex flex-col gap-2 text-sm">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">Commander Game</h1>
        <div className="text-xs text-gray-300">Turn {game.turn} • {game.currentPhase}</div>
      </div>

      {/* Game status */}
      {game.status !== 'playing' && (
        <div className="text-center p-2 bg-yellow-900 rounded text-sm font-bold">
          {game.status === 'playerWon' ? '🎉 You Win!' : '😢 Khoa Wins!'}
        </div>
      )}

      {/* Opponent */}
      <div className="p-3 bg-black/30 rounded border border-red-700 flex justify-between items-center gap-4">
        <div>
          <div className="font-semibold text-sm">Khoa</div>
          <div className="relative inline-block mt-1">
            <img
              src={getCardImageUrl(game.khoaState.commander)}
              alt={game.khoaState.commander.name}
              className="w-16 h-24 rounded border-2 border-red-500 cursor-pointer transition-all duration-200 hover:scale-150 hover:z-50 hover:shadow-2xl hover:shadow-red-400"
              title={game.khoaState.commander.name}
            />
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-400">{game.khoaState.life}</div>
          <div className="text-sm text-gray-400">Library: {game.khoaState.library.length}</div>
          <div className="text-sm text-gray-400">Hand: {game.khoaState.hand.length}</div>
        </div>
      </div>

      {/* Battlefield */}
      <div className="flex-1 p-3 bg-black/20 rounded border border-gray-600 overflow-visible relative">
        <h3 className="text-sm font-bold text-gray-300 mb-2">Creatures on Battlefield</h3>
        <div className="flex gap-3 flex-wrap relative">
          {game.playerState.battlefield
            .filter((c) => c.type_line?.toLowerCase().includes('creature'))
            .map((card) => (
              <div key={card.instanceId} className="relative">
                <img
                  src={getCardImageUrl(card)}
                  alt={card.name}
                  title={card.name}
                  className="w-20 h-32 rounded border-2 border-blue-400 shadow-lg cursor-pointer transition-all duration-200 hover:scale-150 hover:z-50 hover:shadow-2xl hover:shadow-blue-400"
                />
                <div className="absolute bottom-1 right-1 bg-black/90 px-2 py-1 text-sm font-bold rounded border border-white">
                  {card.power}/{card.toughness}
                </div>
              </div>
            ))}
          {game.khoaState.battlefield
            .filter((c) => c.type_line?.toLowerCase().includes('creature'))
            .map((card) => (
              <div key={card.instanceId} className="relative opacity-70">
                <img
                  src={getCardImageUrl(card)}
                  alt={card.name}
                  title={card.name}
                  className="w-20 h-32 rounded border-2 border-red-400 shadow-lg cursor-pointer transition-all duration-200 hover:scale-150 hover:z-50 hover:shadow-2xl hover:shadow-red-400 hover:opacity-100"
                />
                <div className="absolute bottom-1 right-1 bg-black/90 px-2 py-1 text-sm font-bold rounded border border-white">
                  {card.power}/{card.toughness}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Player info */}
      <div className="p-3 bg-black/30 rounded border border-blue-700 flex justify-between items-center gap-4">
        <div>
          <div className="font-semibold text-sm">You</div>
          <div className="relative inline-block mt-1">
            <img
              src={getCardImageUrl(game.playerState.commander)}
              alt={game.playerState.commander.name}
              className="w-16 h-24 rounded border-2 border-blue-500 cursor-pointer transition-all duration-200 hover:scale-150 hover:z-50 hover:shadow-2xl hover:shadow-blue-400"
              title={game.playerState.commander.name}
            />
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-400">{game.playerState.life}</div>
          <div className="text-sm text-gray-400">Library: {game.playerState.library.length}</div>
          <div className="text-sm text-gray-400">Mana: {game.playerState.manaPool}</div>
        </div>
      </div>

      {/* Hand */}
      <div className="p-2 bg-black/40 rounded border border-gray-500 relative z-40">
        <div className="text-xs text-gray-300 mb-1">Hand ({game.playerState.hand.length})</div>
        <div className="flex gap-2 overflow-x-auto pb-2 relative">
          {game.playerState.hand.map((card) => {
            const cardImage = getCardImageUrl(card);
            return (
              <button
                key={card.instanceId}
                onClick={() => {
                  const updatedGame = { ...game };
                  if (card.type_line?.toLowerCase().includes('land')) {
                    applyAction(updatedGame, { type: 'play-land', cardInstanceId: card.instanceId });
                  } else if (game.currentPhase === 'main1' || game.currentPhase === 'main2') {
                    applyAction(updatedGame, { type: 'cast-spell', cardInstanceId: card.instanceId });
                  }
                  setGame(updatedGame);
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredCardImage({
                    url: cardImage,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 20
                  });
                }}
                onMouseLeave={() => setHoveredCardImage(null)}
                disabled={!isPlayerTurn}
                className="flex-shrink-0 cursor-pointer hover:brightness-125 transition-all"
              >
                <img
                  src={cardImage}
                  alt={card.name}
                  title={card.name}
                  className="w-24 h-32 rounded border border-yellow-500"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-1">
        <button
          onClick={handleEndPhase}
          disabled={!isPlayerTurn || game.status !== 'playing'}
          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-xs font-bold"
        >
          Pass ({game.currentPhase})
        </button>
        <button
          onClick={() => setGame(null)}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold"
        >
          New Game
        </button>
      </div>

      {/* Game log */}
      <div className="text-xs bg-black/50 p-1 rounded max-h-16 overflow-y-auto text-gray-300 font-mono">
        {game.log.slice(-6).map((entry, i) => (
          <div key={i}>{entry}</div>
        ))}
      </div>

      {/* Hover Zoom Overlay */}
      {hoveredCardImage && (
        <div
          className="fixed pointer-events-none z-[9999] transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${hoveredCardImage.x}px`,
            top: `${hoveredCardImage.y}px`
          }}
        >
          <img
            src={hoveredCardImage.url}
            alt="Zoomed card"
            className="w-56 h-80 rounded-lg border-4 border-yellow-400 shadow-2xl shadow-yellow-400"
          />
        </div>
      )}
    </div>
  );
}
