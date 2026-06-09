'use client';

import { useState } from 'react';
import type { ScryfallCard } from '@/lib/magic-game/commander-types';

interface DeckReviewProps {
  commander: ScryfallCard;
  deck: ScryfallCard[];
  onStartGame: () => void;
  onChangeCommander?: () => void;
}

export default function DeckReview({ commander, deck, onStartGame, onChangeCommander }: DeckReviewProps) {
  const [sortBy, setSortBy] = useState<'type' | 'cost' | 'name'>('type');

  // Categorize cards
  const categories = {
    lands: deck.filter(c => c.type_line?.toLowerCase().includes('land')),
    creatures: deck.filter(c => c.type_line?.toLowerCase().includes('creature')),
    instants: deck.filter(c => c.type_line?.toLowerCase().includes('instant')),
    sorceries: deck.filter(c => c.type_line?.toLowerCase().includes('sorcery')),
    artifacts: deck.filter(c => c.type_line?.toLowerCase().includes('artifact') && !c.type_line?.toLowerCase().includes('creature')),
    enchantments: deck.filter(c => c.type_line?.toLowerCase().includes('enchantment') && !c.type_line?.toLowerCase().includes('creature')),
    other: deck.filter(c =>
      !c.type_line?.toLowerCase().includes('land') &&
      !c.type_line?.toLowerCase().includes('creature') &&
      !c.type_line?.toLowerCase().includes('instant') &&
      !c.type_line?.toLowerCase().includes('sorcery') &&
      !c.type_line?.toLowerCase().includes('artifact') &&
      !c.type_line?.toLowerCase().includes('enchantment')
    ),
  };

  const getSortedCards = () => {
    const allCards = [...deck];
    if (sortBy === 'cost') {
      return allCards.sort((a, b) => (a.cmc || 0) - (b.cmc || 0));
    } else if (sortBy === 'name') {
      return allCards.sort((a, b) => a.name.localeCompare(b.name));
    }
    return allCards;
  };

  const sortedCards = getSortedCards();

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 to-black text-white p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">{commander.name}</h1>
            <p className="text-gray-400">100-card Commander deck</p>
          </div>
          <img
            src={commander.image_uris?.normal || ''}
            alt={commander.name}
            className="w-24 h-32 rounded border-2 border-purple-500"
          />
        </div>
        <div className="flex gap-2">
          {onChangeCommander && (
            <button
              onClick={onChangeCommander}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold text-lg"
              type="button"
            >
              ← Change
            </button>
          )}
          <button
            onClick={onStartGame}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg"
            type="button"
          >
            ✅ Start Game
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-8 gap-2 bg-black/40 p-3 rounded border border-gray-700">
        <div className="text-center">
          <div className="text-xl font-bold text-blue-400">{categories.lands.length}</div>
          <div className="text-xs text-gray-400">Lands</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-red-400">{categories.creatures.length}</div>
          <div className="text-xs text-gray-400">Creatures</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-yellow-400">{categories.instants.length}</div>
          <div className="text-xs text-gray-400">Instants</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-orange-400">{categories.sorceries.length}</div>
          <div className="text-xs text-gray-400">Sorceries</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-cyan-400">{categories.artifacts.length}</div>
          <div className="text-xs text-gray-400">Artifacts</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-pink-400">{categories.enchantments.length}</div>
          <div className="text-xs text-gray-400">Enchant</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-green-400">{categories.other.length}</div>
          <div className="text-xs text-gray-400">Other</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-purple-400">{deck.length}</div>
          <div className="text-xs text-gray-400">Total</div>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex gap-2">
        <button
          onClick={() => setSortBy('type')}
          className={`px-3 py-1 rounded text-sm ${sortBy === 'type' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          type="button"
        >
          By Type
        </button>
        <button
          onClick={() => setSortBy('cost')}
          className={`px-3 py-1 rounded text-sm ${sortBy === 'cost' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          type="button"
        >
          By Cost
        </button>
        <button
          onClick={() => setSortBy('name')}
          className={`px-3 py-1 rounded text-sm ${sortBy === 'name' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          type="button"
        >
          A-Z
        </button>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto bg-black/40 rounded border border-gray-700 p-3">
        {sortBy === 'type' ? (
          <div className="space-y-4">
            {Object.entries(categories).map(([type, cards]) =>
              cards.length > 0 ? (
                <div key={type}>
                  <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase">{type} ({cards.length})</h3>
                  <div className="space-y-1 ml-2">
                    {cards.map((card, idx) => (
                      <div key={`${type}-${card.id}-${idx}`} className="text-xs text-gray-200 flex justify-between">
                        <span>{card.name}</span>
                        <span className="text-gray-500">{card.cmc ? `${card.cmc}c` : '0c'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {sortedCards.map((card, idx) => (
              <div key={`${sortBy}-${card.id}-${idx}`} className="text-xs text-gray-200 flex justify-between">
                <span>{card.name}</span>
                <span className="text-gray-500">{card.type_line?.split(' — ')[0] || 'Unknown'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
