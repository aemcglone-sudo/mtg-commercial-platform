'use client';

import { useMemo, useState } from 'react';
import type { CollectionCardData } from './CollectionBrowser';

interface Props {
  cards: CollectionCardData[];
}

export default function CollectionInsights({ cards }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const insights = useMemo(() => {
    const totalUnique = cards.length;
    const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
    const totalValue = cards.reduce((s, c) => s + (c.priceUsd ?? 0) * c.quantity, 0);
    const avgValue = totalCards > 0 ? totalValue / totalCards : 0;

    // Color distribution
    const colorCounts = new Map<string, number>();
    for (const card of cards) {
      let colorKey: string;
      if (!card.colors || card.colors.length === 0) {
        colorKey = 'C'; // Colorless
      } else if (card.colors.length > 1) {
        colorKey = 'M'; // Multi-color
      } else {
        colorKey = card.colors[0]; // Single color
      }
      colorCounts.set(colorKey, (colorCounts.get(colorKey) ?? 0) + card.quantity);
    }

    // Rarity distribution
    const rarityCounts = new Map<string, number>();
    for (const card of cards) {
      const rarity = card.rarity || 'unknown';
      rarityCounts.set(rarity, (rarityCounts.get(rarity) ?? 0) + card.quantity);
    }

    // Top 5 most valuable cards
    const topValueCards = [...cards]
      .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
      .slice(0, 5);

    // CMC distribution
    const cmcBuckets = {
      '0': 0,
      '1-2': 0,
      '3-4': 0,
      '5-6': 0,
      '7+': 0,
    };
    for (const card of cards) {
      const cmc = card.cmc ?? 0;
      if (cmc === 0) cmcBuckets['0']++;
      else if (cmc <= 2) cmcBuckets['1-2']++;
      else if (cmc <= 4) cmcBuckets['3-4']++;
      else if (cmc <= 6) cmcBuckets['5-6']++;
      else cmcBuckets['7+']++;
    }

    return {
      totalUnique,
      totalCards,
      totalValue,
      avgValue,
      colorCounts,
      rarityCounts,
      topValueCards,
      cmcBuckets,
    };
  }, [cards]);

  const COLORS = [
    { id: 'W', label: 'White', bg: 'bg-yellow-50' },
    { id: 'U', label: 'Blue', bg: 'bg-blue-600' },
    { id: 'B', label: 'Black', bg: 'bg-zinc-700' },
    { id: 'R', label: 'Red', bg: 'bg-red-600' },
    { id: 'G', label: 'Green', bg: 'bg-green-700' },
    { id: 'C', label: 'Colorless', bg: 'bg-zinc-500' },
    { id: 'M', label: 'Multi', bg: 'bg-amber-400' },
  ];

  if (!isExpanded) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors flex items-center justify-between"
        >
          <div className="text-left">
            <div className="font-semibold text-zinc-100">Collection Insights</div>
            <div className="text-sm text-zinc-500 mt-1">
              {insights.totalUnique.toLocaleString()} cards · ${insights.totalValue.toFixed(2)} total value
            </div>
          </div>
          <div className="text-2xl text-zinc-400">→</div>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-8">
      {/* Collapse button */}
      <button
        type="button"
        onClick={() => setIsExpanded(false)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span>← Collapse</span>
      </button>

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-1">Unique Cards</div>
          <div className="text-2xl font-bold text-zinc-100">
            {insights.totalUnique.toLocaleString()}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-1">Total Cards</div>
          <div className="text-2xl font-bold text-zinc-100">
            {insights.totalCards.toLocaleString()}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-1">Total Value</div>
          <div className="text-2xl font-bold text-amber-400">
            ${insights.totalValue.toFixed(2)}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-1">Avg Card Price</div>
          <div className="text-2xl font-bold text-zinc-100">
            ${insights.avgValue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Color & Rarity Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Color Distribution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Color Distribution</h3>
          <div className="space-y-2">
            {COLORS.map(color => {
              const count = insights.colorCounts.get(color.id) ?? 0;
              const pct = insights.totalCards > 0 ? (count / insights.totalCards) * 100 : 0;
              return (
                <div key={color.id} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${color.bg}`} title={color.label} />
                  <span className="text-xs text-zinc-400 w-12" title={color.label}>{color.label}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${color.bg} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-12 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rarity Distribution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Rarity Distribution</h3>
          <div className="space-y-2">
            {(['mythic', 'rare', 'uncommon', 'common'] as const).map(rarity => {
              const count = insights.rarityCounts.get(rarity) ?? 0;
              const pct = insights.totalCards > 0 ? (count / insights.totalCards) * 100 : 0;
              const colors = {
                mythic: 'bg-orange-400',
                rare: 'bg-amber-400',
                uncommon: 'bg-slate-400',
                common: 'bg-zinc-500',
              };
              const rarityLabels = {
                mythic: 'Mythic Rare',
                rare: 'Rare',
                uncommon: 'Uncommon',
                common: 'Common',
              };
              return (
                <div key={rarity} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-20 capitalize" title={rarityLabels[rarity]}>{rarity}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${colors[rarity]} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-12 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Value Cards - Compact */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
        <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Top Cards</h3>
        <div className="space-y-1">
          {insights.topValueCards.slice(0, 3).map((card, idx) => (
            <div key={card.name} className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 truncate">
                <span className="text-zinc-600">{idx + 1}.</span> {card.name}
              </span>
              <span className="text-amber-400 font-medium ml-2 shrink-0">
                ${((card.priceUsd ?? 0) * card.quantity).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
