'use client';

import { useEffect, useState } from 'react';

interface CollectionData {
  collection: {
    totalValue: number;
    valueChange7d: number;
    uniqueCards: number;
    totalCards: number;
    paperCards: number;
    arenaCards: number;
    lastUpdated: string;
  };
  topCards: Array<{
    name: string;
    quantity: number;
    price: number;
    totalValue: number;
  }>;
  recentPrices: Array<{
    name: string;
    price: number;
    updated: string;
  }>;
}

export default function CollectionDashboard() {
  const [data, setData] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/collection/dashboard')
      .then(async r => {
        if (!r.ok) {
          throw new Error(`API error: ${r.status}`);
        }
        return r.json();
      })
      .then(setData)
      .catch(err => {
        console.error('Dashboard error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-zinc-500">Loading collection data...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  if (!data) return <div className="text-center py-8 text-zinc-500">No collection data</div>;

  const changeColor = data.collection.valueChange7d >= 0 ? 'text-green-400' : 'text-red-400';
  const changeIcon = data.collection.valueChange7d >= 0 ? '↑' : '↓';

  return (
    <div className="space-y-8">
      {/* Value Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-zinc-400 text-sm font-medium mb-2">Total Value</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-amber-400">
              ${data.collection.totalValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className={`text-lg font-semibold ${changeColor}`}>
              {changeIcon} {Math.abs(data.collection.valueChange7d).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Last updated: {new Date(data.collection.lastUpdated).toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-medium mb-1">Unique Cards</p>
            <p className="text-2xl font-bold text-zinc-100">{data.collection.uniqueCards.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-medium mb-1">Total Cards</p>
            <p className="text-2xl font-bold text-zinc-100">{data.collection.totalCards.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-medium mb-1">Paper</p>
            <p className="text-2xl font-bold text-zinc-100">{data.collection.paperCards.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs font-medium mb-1">Arena</p>
            <p className="text-2xl font-bold text-zinc-100">{data.collection.arenaCards.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Top Valuable Cards */}
      {data.topCards.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Most Valuable Cards</h3>
          <div className="space-y-2">
            {data.topCards.map((card, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div className="flex-1">
                  <p className="font-medium text-zinc-100">{card.name}</p>
                  <p className="text-xs text-zinc-500">
                    {card.quantity}x @ ${card.price.toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold text-amber-400">
                  ${card.totalValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Price Updates */}
      {data.recentPrices.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Recent Price Updates</h3>
          <div className="space-y-2">
            {data.recentPrices.slice(0, 8).map((price, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <p className="text-sm text-zinc-100">{price.name}</p>
                <div className="text-right">
                  <p className="font-semibold text-amber-400">${price.price.toFixed(2)}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(price.updated).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
