'use client';

import { useEffect, useState } from 'react';
import CollectionDashboard from './CollectionDashboard';

interface InsightsData {
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

export default function CollectionInsightsTab() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch('/api/collection/dashboard')
      .then(async r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(err => console.error('Insights error:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/background/update-prices', {
        headers: { 'Authorization': 'Bearer secret' },
      });
      if (res.ok) {
        // Refresh data after update
        const updated = await fetch('/api/collection/dashboard').then(r => r.json());
        setData(updated);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-zinc-500">Loading collection insights...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Collection Insights</h2>
        <button
          onClick={handleRefreshPrices}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? '⟳ Updating...' : '⟳ Update Prices'}
        </button>
      </div>

      {/* Dashboard Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-bold mb-6">Portfolio Value</h3>
        <CollectionDashboard />
      </div>

      {/* Coming Soon Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Price Alerts (Phase 1B) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 opacity-50">
          <h3 className="text-lg font-bold mb-4">🚨 Price Alerts</h3>
          <p className="text-zinc-400 text-sm">
            Get notified when cards in your collection spike or crash
          </p>
          <p className="text-zinc-500 text-xs mt-2">Coming soon in Phase 1B</p>
        </div>

        {/* Grading Recommendations (Phase 1B) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 opacity-50">
          <h3 className="text-lg font-bold mb-4">📊 Grading Candidates</h3>
          <p className="text-zinc-400 text-sm">
            Cards worth sending for professional grading
          </p>
          <p className="text-zinc-500 text-xs mt-2">Coming soon in Phase 1B</p>
        </div>

        {/* Set Completion (Phase 1B) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 opacity-50">
          <h3 className="text-lg font-bold mb-4">📚 Set Completion</h3>
          <p className="text-zinc-400 text-sm">
            Track your progress toward completing Magic sets
          </p>
          <p className="text-zinc-500 text-xs mt-2">Coming soon in Phase 1B</p>
        </div>

        {/* Duplication Solver (Phase 1B) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 opacity-50">
          <h3 className="text-lg font-bold mb-4">🔄 Duplication Solver</h3>
          <p className="text-zinc-400 text-sm">
            Find decks that use your duplicate cards
          </p>
          <p className="text-zinc-500 text-xs mt-2">Coming soon in Phase 1B</p>
        </div>
      </div>

      {/* Data Refresh Info */}
      {data?.collection.lastUpdated && (
        <div className="text-center text-sm text-zinc-500">
          Last price update: {new Date(data.collection.lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
