'use client';

import { useEffect, useState, useMemo } from 'react';
import CollectionInsights from './CollectionInsights';
import CardDetailModal from './CardDetailModal';
import type { CollectionCardData } from './CollectionBrowser';


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
  topCards: Array<{ name: string; quantity: number; price: number; totalValue: number }>;
  recentPrices: Array<{ name: string; price: number; updated: string }>;
}

interface ExpensiveCard { name: string; price: number; set: string }
interface TrendingCard {
  name: string;
  discussionCount: number;
  trend: number;
  arrow: '▲' | '▼';
  trendColor: 'text-green-500' | 'text-red-500';
}
interface SetCompletion { setName: string; owned: number; total: number; pct: number }

interface Props {
  cards?: CollectionCardData[];
}

export default function CollectionInsightsTab({ cards = [] }: Props) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [cardSentiment, setCardSentiment] = useState<Record<string, number>>({});
  const [expensiveCards, setExpensiveCards] = useState<ExpensiveCard[]>([]);
  const [trendingCards, setTrendingCards] = useState<TrendingCard[]>([]);
  const [scryfallSets, setScryfallSets] = useState<Record<string, number>>({});
  const [setsLoading, setSetsLoading] = useState(false);


  useEffect(() => {
    Promise.all([
      fetch('/api/collection/dashboard').then(r => r.ok ? r.json() : null),
      fetch('/api/expensive-cards').then(r => r.ok ? r.json() : { cards: [] }),
      fetch('/api/trending-cards').then(r => r.ok ? r.json() : { cards: [] }),
    ])
      .then(([dashData, expensiveData, trendingData]) => {
        if (dashData) setData(dashData);
        setExpensiveCards(expensiveData?.cards ?? []);
        setTrendingCards(trendingData?.cards ?? []);
      })
      .catch(err => console.error('Dashboard error:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (cards.length === 0) return;
    const topCardNames = [...cards]
      .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
      .slice(0, 10)
      .map(c => c.name);
    fetch('/api/card-sentiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: topCardNames }),
    })
      .then(r => r.json())
      .then((d: any) => {
        const sentiment: Record<string, number> = {};
        for (const result of d.results ?? []) sentiment[result.card] = result.score;
        setCardSentiment(sentiment);
      })
      .catch(err => console.error('Card sentiment error:', err));
  }, [cards]);

  useEffect(() => {
    if (cards.length === 0) return;
    setSetsLoading(true);
    fetch('https://api.scryfall.com/sets')
      .then(r => r.json())
      .then((d: any) => {
        const sets: Record<string, number> = {};
        for (const s of d.data ?? []) {
          if (s.name && s.card_count) sets[s.name] = s.card_count;
        }
        setScryfallSets(sets);
      })
      .catch(err => console.error('Set completion error:', err))
      .finally(() => setSetsLoading(false));
  }, [cards]);


  const setCompletions = useMemo<SetCompletion[]>(() => {
    if (Object.keys(scryfallSets).length === 0) return [];
    const ownedBySet = new Map<string, number>();
    for (const c of cards) {
      if (!c.setName) continue;
      ownedBySet.set(c.setName, (ownedBySet.get(c.setName) ?? 0) + 1);
    }
    const completions: SetCompletion[] = [];
    for (const [setName, owned] of ownedBySet) {
      const total = scryfallSets[setName];
      if (!total || total < 10) continue;
      completions.push({ setName, owned, total, pct: Math.min(100, Math.round((owned / total) * 100)) });
    }
    return completions.sort((a, b) => b.pct - a.pct).slice(0, 20);
  }, [cards, scryfallSets]);

  const duplicates = useMemo(() =>
    cards
      .filter(c => c.quantity > 1)
      .sort((a, b) => {
        const qDiff = b.quantity - a.quantity;
        return qDiff !== 0 ? qDiff : (b.priceUsd ?? 0) - (a.priceUsd ?? 0);
      })
      .slice(0, 50),
    [cards]
  );

  const gradingCandidates = useMemo(() =>
    cards
      .filter(c => (c.priceUsd ?? 0) >= 15)
      .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
      .slice(0, 50),
    [cards]
  );

  const watchlist = useMemo(() =>
    cards
      .filter(c => (c.priceUsd ?? 0) >= 20)
      .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
      .slice(0, 50),
    [cards]
  );


  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/background/update-prices', {
        headers: { 'Authorization': 'Bearer secret' },
      });
      if (res.ok) {
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold">Collection Insights</h2>
        <button
          type="button"
          onClick={handleRefreshPrices}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? '⟳ Updating...' : '⟳ Update Prices'}
        </button>
      </div>

      {/* Main dashboard */}
      {cards.length > 0 && (
        <CollectionInsights
          cards={cards}
          onCardClick={setSelectedCard}
          cardSentiment={cardSentiment}
          expensiveCards={expensiveCards}
          trendingCards={trendingCards}
        />
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          cardName={selectedCard}
          onClose={() => setSelectedCard(null)}
          collectionCard={cards.find(c => c.name === selectedCard)}
        />
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* High Value Watchlist */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold">🚨 High Value Watchlist</h3>
            <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded">Price Alerts</span>
          </div>
          <p className="text-zinc-500 text-sm mb-3">Paper cards worth $20+ — track these for market movement</p>
          {watchlist.length === 0 ? (
            <p className="text-zinc-600 text-sm">No paper cards over $20.</p>
          ) : (
            <div className="overflow-y-auto max-h-72 divide-y divide-zinc-800 pr-1">
              {watchlist.map(c => (
                <div key={c.name} className="flex items-center justify-between py-2">
                  <div className="min-w-0 mr-2">
                    <button type="button" onClick={() => setSelectedCard(c.name)} className="text-zinc-100 text-sm font-medium hover:text-amber-400 transition-colors text-left">{c.name}</button>
                    {c.setName && <span className="text-zinc-500 text-xs ml-2">{c.setName}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-500">{c.quantity}x</span>
                    <span className={`text-sm font-semibold ${(c.priceUsd ?? 0) >= 50 ? 'text-amber-400' : 'text-zinc-300'}`}>
                      ${c.priceUsd?.toFixed(2)}
                    </span>
                    {(c.priceUsd ?? 0) >= 50 && (
                      <span className="text-xs bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded">High</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grading Candidates */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-bold mb-1">📊 Grading Candidates</h3>
          <p className="text-zinc-500 text-sm mb-3">Paper cards worth $15+ that may be worth professional grading</p>
          {gradingCandidates.length === 0 ? (
            <p className="text-zinc-600 text-sm">No paper cards over $15 found.</p>
          ) : (
            <div className="overflow-y-auto max-h-72 divide-y divide-zinc-800 pr-1">
              {gradingCandidates.map(c => {
                const gradeTier = (c.priceUsd ?? 0) >= 100 ? { label: 'Strong candidate', color: 'text-emerald-400 bg-emerald-900/50' }
                  : (c.priceUsd ?? 0) >= 50 ? { label: 'Consider grading', color: 'text-amber-400 bg-amber-900/50' }
                  : { label: 'Worth evaluating', color: 'text-zinc-400 bg-zinc-800' };
                return (
                  <div key={c.name} className="flex items-center justify-between py-2">
                    <div className="min-w-0 mr-2">
                      <button type="button" onClick={() => setSelectedCard(c.name)} className="text-zinc-100 text-sm font-medium hover:text-amber-400 transition-colors text-left">{c.name}</button>
                      {c.setName && <span className="text-zinc-500 text-xs ml-2">{c.setName}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${gradeTier.color}`}>{gradeTier.label}</span>
                      <span className="text-sm font-semibold text-zinc-300">${c.priceUsd?.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Set Completion */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-bold mb-1">📚 Set Completion</h3>
          <p className="text-zinc-500 text-sm mb-3">Your progress toward completing Magic sets</p>
          {setsLoading ? (
            <div className="text-zinc-500 text-sm">Loading set data…</div>
          ) : setCompletions.length === 0 ? (
            <p className="text-zinc-600 text-sm">No set completion data available.</p>
          ) : (
            <div className="overflow-y-auto max-h-72 space-y-3 pr-1">
              {setCompletions.map(s => (
                <div key={s.setName}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-zinc-100 text-sm">{s.setName}</span>
                    <span className="text-zinc-400 text-xs shrink-0 ml-2">{s.owned} / {s.total} ({s.pct}%)</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${s.pct >= 75 ? 'bg-emerald-500' : s.pct >= 40 ? 'bg-amber-500' : 'bg-zinc-600'}`}
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Duplication Solver */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-bold mb-1">🔄 Duplication Solver</h3>
          <p className="text-zinc-500 text-sm mb-3">Paper cards you own multiple copies of — trade, sell, or slot into more decks</p>
          {duplicates.length === 0 ? (
            <p className="text-zinc-600 text-sm">No duplicate paper cards found.</p>
          ) : (
            <div className="overflow-y-auto max-h-72 divide-y divide-zinc-800 pr-1">
              {duplicates.map(c => {
                const extras = c.quantity - 1;
                const extraValue = extras * (c.priceUsd ?? 0);
                return (
                  <div key={c.name} className="flex items-center justify-between py-2">
                    <div className="min-w-0 mr-2">
                      <button type="button" onClick={() => setSelectedCard(c.name)} className="text-zinc-100 text-sm font-medium hover:text-amber-400 transition-colors text-left">{c.name}</button>
                      {c.setName && <span className="text-zinc-500 text-xs ml-2">{c.setName}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-500">{c.quantity}x</span>
                      <span className="text-xs text-amber-400">{extras} extra{extras > 1 ? 's' : ''}</span>
                      {extraValue >= 1 && (
                        <span className="text-xs text-zinc-300">${extraValue.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>{/* end two-column grid */}


      {data?.collection.lastUpdated && (
        <div className="text-center text-sm text-zinc-500">
          Last price update: {new Date(data.collection.lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
