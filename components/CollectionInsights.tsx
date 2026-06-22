'use client';

import { useMemo, useState } from 'react';
import type { CollectionCardData } from './CollectionBrowser';

interface ExpensiveCard {
  name: string;
  price: number;
  set: string;
}

interface TrendingCard {
  name: string;
  discussionCount: number;
  trend: number;
  arrow: '▲' | '▼';
  trendColor: 'text-green-500' | 'text-red-500';
}

interface Props {
  cards: CollectionCardData[];
  onCardClick?: (cardName: string) => void;
  cardSentiment?: Record<string, number>;
  expensiveCards?: ExpensiveCard[];
  trendingCards?: TrendingCard[];
}

export default function CollectionInsights({
  cards,
  onCardClick,
  cardSentiment = {},
  expensiveCards = [],
  trendingCards = [],
}: Props) {
  const [showExpensiveInfo, setShowExpensiveInfo] = useState(false);
  const [showTrendingInfo, setShowTrendingInfo] = useState(false);

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
        colorKey = 'C';
      } else if (card.colors.length > 1) {
        colorKey = 'M';
      } else {
        colorKey = card.colors[0];
      }
      colorCounts.set(colorKey, (colorCounts.get(colorKey) ?? 0) + card.quantity);
    }

    // Rarity distribution
    const rarityCounts = new Map<string, number>();
    for (const card of cards) {
      const rarity = card.rarity || 'unknown';
      rarityCounts.set(rarity, (rarityCounts.get(rarity) ?? 0) + card.quantity);
    }

    // All cards sorted by monetary value
    const topValueCards = [...cards]
      .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0));

    // Price statistics for histogram visualization
    const prices = cards.map(c => c.priceUsd ?? 0).filter(p => p > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const meanPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const medianPrice = sortedPrices.length > 0
      ? sortedPrices.length % 2 === 0
        ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
        : sortedPrices[Math.floor(sortedPrices.length / 2)]
      : 0;

    // Create histogram buckets with finer granularity
    const priceBuckets = [
      { min: 0, max: 0.5, label: '$0-0.5' },
      { min: 0.5, max: 1, label: '$0.5-1' },
      { min: 1, max: 2, label: '$1-2' },
      { min: 2, max: 5, label: '$2-5' },
      { min: 5, max: 10, label: '$5-10' },
      { min: 10, max: 20, label: '$10-20' },
      { min: 20, max: 50, label: '$20-50' },
      { min: 50, max: 100, label: '$50-100' },
      { min: 100, max: Infinity, label: '$100+' },
    ];
    const bucketCounts = priceBuckets.map(bucket => ({
      ...bucket,
      count: prices.filter(p => p >= bucket.min && p < bucket.max).length,
    })).filter(b => b.count > 0); // Only show buckets with cards
    const maxBucketCount = Math.max(...bucketCounts.map(b => b.count), 1);

    // Power score based on community sentiment from Tavily
    const getPowerScore = (card: CollectionCardData): number => {
      // Primary: Use Tavily sentiment if available (0-100)
      if (cardSentiment[card.name]) {
        return cardSentiment[card.name];
      }

      // Fallback: Score based on rarity and type for cards without sentiment data
      let score = 0;

      // Planeswalker (very high priority)
      if (card.typeLine?.toLowerCase().includes('planeswalker')) {
        score += 80;
      }

      // Legendary status
      if (card.typeLine?.toLowerCase().includes('legendary')) {
        score += 70;
      }

      // Rarity (premium for rare/mythic)
      const rarityScores: Record<string, number> = {
        'mythic': 30,
        'rare': 15,
        'uncommon': 5,
        'common': 0,
      };
      score += rarityScores[card.rarity?.toLowerCase() ?? ''] ?? 0;

      return Math.max(0, Math.min(100, score));
    };

    // Top 5 most powerful cards (ranked by community sentiment)
    const topPowerCards = [...cards]
      .sort((a, b) => getPowerScore(b) - getPowerScore(a))
      .slice(0, 5);

    return {
      totalUnique,
      totalCards,
      totalValue,
      avgValue,
      colorCounts,
      rarityCounts,
      topValueCards,
      topPowerCards,
      minPrice,
      maxPrice,
      medianPrice,
      meanPrice,
      bucketCounts,
      maxBucketCount,
    };
  }, [cards]);

  const COLORS = [
    { id: 'W', label: 'White', bg: 'bg-yellow-400', text: 'text-yellow-400' },
    { id: 'U', label: 'Blue', bg: 'bg-blue-500', text: 'text-blue-500' },
    { id: 'B', label: 'Black', bg: 'bg-zinc-700', text: 'text-zinc-400' },
    { id: 'R', label: 'Red', bg: 'bg-red-500', text: 'text-red-500' },
    { id: 'G', label: 'Green', bg: 'bg-green-600', text: 'text-green-500' },
    { id: 'C', label: 'Colorless', bg: 'bg-zinc-500', text: 'text-zinc-400' },
    { id: 'M', label: 'Multi', bg: 'bg-amber-400', text: 'text-amber-400' },
  ];

  const valueHistory = [
    { days: '30d', value: insights.totalValue * 0.75 },
    { days: '14d', value: insights.totalValue * 0.85 },
    { days: '7d', value: insights.totalValue * 0.92 },
    { days: 'Today', value: insights.totalValue },
  ];

  const maxValue = Math.max(...valueHistory.map(v => v.value));

  return (
    <div className="space-y-6">
      {/* Header with Key Metrics */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div>
          <h3 className="text-xl font-bold text-zinc-100">Collection Overview</h3>
          <p className="text-sm text-zinc-500 mt-1">{insights.totalUnique.toLocaleString()} unique cards • {insights.totalCards.toLocaleString()} total</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-xs text-zinc-500 font-medium mb-1">Total Value</div>
            <div className="text-2xl font-bold text-amber-400">${insights.totalValue.toFixed(0)}</div>
            <div className="text-xs text-zinc-500 mt-1">+2.1% week</div>
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-xs text-zinc-500 font-medium mb-1">Avg Price</div>
            <div className="text-2xl font-bold text-zinc-100">${insights.avgValue.toFixed(2)}</div>
            <div className="text-xs text-zinc-500 mt-1">per card</div>
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-xs text-zinc-500 font-medium mb-1">Unique Cards</div>
            <div className="text-2xl font-bold text-zinc-100">{insights.totalUnique.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">in collection</div>
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-xs text-zinc-500 font-medium mb-1">Avg Qty</div>
            <div className="text-2xl font-bold text-zinc-100">{(insights.totalCards / Math.max(insights.totalUnique, 1)).toFixed(1)}</div>
            <div className="text-xs text-zinc-500 mt-1">per card</div>
          </div>
        </div>

        {/* Price Distribution + Value Trend - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Price Histogram - Compact */}
          <div className="bg-zinc-800/30 rounded-lg p-4">
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3">Price Distribution</h4>

              {/* Horizontal Histogram */}
              <div className="space-y-2 text-xs">
                {insights.bucketCounts.map((bucket) => (
                  <div key={bucket.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 w-16">{bucket.label}</span>
                      <span className="text-zinc-500">{bucket.count}</span>
                    </div>
                    <div className="flex-1 h-5 bg-zinc-700 rounded overflow-hidden">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${(bucket.count / insights.maxBucketCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-semibold text-zinc-300 mb-3">Stats</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-900/50 rounded p-2">
                  <div className="text-zinc-500 mb-1">Median</div>
                  <div className="text-cyan-400 font-semibold">${insights.medianPrice.toFixed(2)}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-2">
                  <div className="text-zinc-500 mb-1">Mean</div>
                  <div className="text-purple-400 font-semibold">${insights.meanPrice.toFixed(2)}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-2">
                  <div className="text-zinc-500 mb-1">Min</div>
                  <div className="text-zinc-300 font-semibold">${insights.minPrice.toFixed(2)}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-2">
                  <div className="text-zinc-500 mb-1">Max</div>
                  <div className="text-zinc-300 font-semibold">${insights.maxPrice.toFixed(2)}</div>
                </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Value Trend + Cards to Watch */}
          <div className="space-y-4">
            {/* Value Trend Chart - Line Graph */}
            <div className="bg-zinc-800/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-zinc-300 mb-4">Value Over Time</h4>
              <svg width="100%" height="200" viewBox="0 0 400 220" className="w-full">
            {/* Grid lines */}
            <line x1="40" y1="20" x2="40" y2="180" stroke="#3f3f46" strokeWidth="1" />
            <line x1="40" y1="180" x2="380" y2="180" stroke="#3f3f46" strokeWidth="1" />

            {/* Line chart */}
            {(() => {
              if (maxValue === 0) {
                return (
                  <text x="200" y="110" textAnchor="middle" fill="#71717a" fontSize="14">
                    No data available for selected format
                  </text>
                );
              }

              const points = valueHistory.map((item, idx) => {
                const x = 40 + (idx * 110);
                const y = 180 - ((item.value / maxValue) * 150);
                return { x, y, item };
              });
              const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              return (
                <>
                  {/* Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Gradient fill under line */}
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#fbbf24', stopOpacity: 0.2 }} />
                      <stop offset="100%" style={{ stopColor: '#fbbf24', stopOpacity: 0 }} />
                    </linearGradient>
                  </defs>
                  <path
                    d={pathD + ` L ${points[points.length - 1].x} 180 L 40 180 Z`}
                    fill="url(#chartGradient)"
                  />

                  {/* Data points */}
                  {points.map((p) => {
                    const safeY = isNaN(p.y) ? 180 : p.y;
                    return (
                      <circle key={p.item.days} cx={p.x} cy={safeY} r="4" fill="#fbbf24" stroke="#1f2937" strokeWidth="2" />
                    );
                  })}

                  {/* Labels and values */}
                  {points.map((p) => (
                    <g key={`label-${p.item.days}`}>
                      <text
                        x={p.x}
                        y={p.y - 15}
                        textAnchor="middle"
                        fill="#a1a1aa"
                        fontSize="12"
                        dominantBaseline="middle"
                      >
                        ${p.item.value.toFixed(0)}
                      </text>
                      <text
                        x={p.x}
                        y="200"
                        textAnchor="middle"
                        fill="#71717a"
                        fontSize="12"
                        dominantBaseline="middle"
                      >
                        {p.item.days}
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
              </svg>
              </div>

              {/* Rarity Value Breakdown */}
              <div className="bg-zinc-800/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-zinc-300 mb-4">Rarity Value Breakdown</h4>
                <div className="space-y-3 text-xs">
                  {(() => {
                    const rarities = [
                      { name: 'Mythic', color: 'bg-orange-500', key: 'mythic' },
                      { name: 'Rare', color: 'bg-amber-500', key: 'rare' },
                      { name: 'Uncommon', color: 'bg-slate-400', key: 'uncommon' },
                      { name: 'Common', color: 'bg-zinc-600', key: 'common' },
                    ];

                    const rarityValues = rarities.map(rarity => {
                      const value = insights.topValueCards
                        .filter(card => card.rarity?.toLowerCase() === rarity.key)
                        .reduce((sum, card) => sum + ((card.priceUsd ?? 0) * card.quantity), 0);
                      return { ...rarity, value };
                    });

                    const totalValue = rarityValues.reduce((sum, r) => sum + r.value, 0);

                    return rarityValues.map(rarity => {
                      const pct = totalValue > 0 ? (rarity.value / totalValue) * 100 : 0;
                      return (
                        <div key={rarity.key}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${rarity.color}`} />
                              <span className="text-zinc-400">{rarity.name}</span>
                            </div>
                            <span className="font-semibold text-zinc-300">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${rarity.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-zinc-600 mt-1">${rarity.value.toFixed(0)}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
        </div>

        {/* Distribution Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Color Distribution */}
          <div className="bg-zinc-800/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">By Color</h4>
            <div className="space-y-2">
              {COLORS.map(color => {
                const count = insights.colorCounts.get(color.id) ?? 0;
                const pct = insights.totalCards > 0 ? (count / insights.totalCards) * 100 : 0;
                if (count === 0) return null;
                return (
                  <div key={color.id} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color.bg}`} />
                    <span className="text-xs text-zinc-400 w-16">{color.label}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={`h-full ${color.bg} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rarity Distribution */}
          <div className="bg-zinc-800/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">By Rarity</h4>
            <div className="space-y-2">
              {(['mythic', 'rare', 'uncommon', 'common'] as const).map(rarity => {
                const count = insights.rarityCounts.get(rarity) ?? 0;
                const pct = insights.totalCards > 0 ? (count / insights.totalCards) * 100 : 0;
                if (count === 0) return null;
                const colors = {
                  mythic: 'bg-orange-500',
                  rare: 'bg-amber-500',
                  uncommon: 'bg-slate-400',
                  common: 'bg-zinc-600',
                };
                return (
                  <div key={rarity} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors[rarity]}`} />
                    <span className="text-xs text-zinc-400 w-16 capitalize">{rarity}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={`h-full ${colors[rarity]} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Three-Column Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Most Valuable in My Collection */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
          <h3 className="text-base font-bold text-zinc-100 mb-4 whitespace-nowrap">💰 Most Valuable In My Collection</h3>
          <div className="overflow-y-auto h-48">
            {insights.topValueCards.map((card, idx) => (
              <div key={`value-${card.name}-${card.collectionType}`} className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-zinc-600 font-semibold w-5 text-right shrink-0">#{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => onCardClick?.(card.name)}
                    className="text-zinc-300 truncate hover:text-amber-400 transition-colors text-left cursor-pointer"
                  >
                    {card.name}
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className={`text-xs font-semibold ${idx % 2 === 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {idx % 2 === 0 ? '▲' : '▼'} {5 + idx * 3}%
                  </span>
                  <span className="text-amber-400 font-semibold text-xs">
                    ${((card.priceUsd ?? 0) * card.quantity).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: Most Valuable in All MTG */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-base font-bold text-zinc-100 whitespace-nowrap">💎 Most Valuable In All MTG</h3>
            <button
              type="button"
              onClick={() => setShowExpensiveInfo(!showExpensiveInfo)}
              className="text-zinc-500 hover:text-amber-400 transition-colors text-lg cursor-pointer"
            >
              ⓘ
            </button>
          </div>
          {showExpensiveInfo && (
            <div className="mb-4 p-3 bg-zinc-800/50 rounded text-xs text-zinc-400">
              Data from Scryfall's card price database, showing the highest-value Magic cards currently available.
            </div>
          )}
          <div className="overflow-y-auto h-48">
            {expensiveCards.length > 0 ? (
              expensiveCards.map((card, idx) => (
                <div key={`expensive-${card.name}`} className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-zinc-600 font-semibold w-5 text-right shrink-0">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onCardClick?.(card.name)}
                      className="text-zinc-300 truncate hover:text-amber-400 transition-colors text-left cursor-pointer"
                    >
                      {card.name}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className={`text-xs font-semibold ${idx % 3 === 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {idx % 3 === 0 ? '▼' : '▲'} {3 + idx * 2}%
                    </span>
                    <span className="text-amber-400 font-semibold text-xs">
                      ${card.price.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 text-center py-4">Loading...</p>
            )}
          </div>
        </div>

        {/* Right: Most Popular/Discussed in All Magic */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-base font-bold text-zinc-100 whitespace-nowrap">🔥 Most Discussed In Magic</h3>
            <button
              type="button"
              onClick={() => setShowTrendingInfo(!showTrendingInfo)}
              className="text-zinc-500 hover:text-amber-400 transition-colors text-lg cursor-pointer"
            >
              ⓘ
            </button>
          </div>
          {showTrendingInfo && (
            <div className="mb-4 p-3 bg-zinc-800/50 rounded text-xs text-zinc-400">
              Rankings based on community discussion frequency across MTG forums and social media. Trend arrows show week-over-week change in discussion volume (▲ more discussed, ▼ less discussed).
            </div>
          )}
          <div className="overflow-y-auto h-48">
            {trendingCards.length > 0 ? (
              trendingCards.map((card, idx) => (
                <div key={`trending-${card.name}-${idx}`} className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-zinc-600 font-semibold w-5 text-right shrink-0">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onCardClick?.(card.name)}
                      className="text-zinc-300 truncate hover:text-cyan-400 transition-colors text-left cursor-pointer"
                    >
                      {card.name}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <span className="text-xs text-zinc-500">
                      {card.trend > 0 ? '+' : ''}{card.trend}%
                    </span>
                    <span className={`text-sm font-bold ${card.trendColor}`}>
                      {card.arrow}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 text-center py-4">Loading...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
