'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import AsOfDate from '@/components/AsOfDate';

interface DeckValueSummary { deckId: string; deckName: string; commander: string | null; totalValue: number; cardCount: number; cardsMatched: number }

type Sort = 'value_desc' | 'value_asc' | 'name';

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DeckValuePage() {
  const [decks, setDecks] = useState<DeckValueSummary[] | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('value_desc');
  const [filter, setFilter] = useState<'all' | 'incomplete'>('all');

  const load = useCallback(async () => {
    const res = await fetch('/api/decks/value').then(r => r.json());
    setDecks(res.decks ?? []);
    setComputedAt(res.computedAt ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (!decks) return [];
    let rows = filter === 'incomplete' ? decks.filter(d => d.cardsMatched < d.cardCount) : decks;
    rows = [...rows].sort((a, b) => {
      if (sort === 'value_desc') return b.totalValue - a.totalValue;
      if (sort === 'value_asc') return a.totalValue - b.totalValue;
      return a.deckName.localeCompare(b.deckName);
    });
    return rows;
  }, [decks, filter, sort]);

  const totalAcrossDecks = useMemo(() => (decks ?? []).reduce((a, d) => a + d.totalValue, 0), [decks]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Commander Deck Values</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Estimated cost to assemble each deck, priced at each card's cheapest tracked printing.</p>
        </div>
        <BackButton fallbackHref="/" />
      </div>
      <AsOfDate date={computedAt ? computedAt.slice(0, 10) : null} label="Computed as of" />
      <p className="text-xs text-zinc-600 mt-1 mb-6">
        Not a market-cap for your specific copies — decks are stored as card names, not exact printings, so this prices every card at the
        cheapest currently-tracked printing (a "cost to acquire" estimate). For your actual owned copies' real value, see{' '}
        <Link href="/portfolio" className="underline hover:text-amber-400">My Portfolio</Link>.
      </p>

      {decks === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {decks !== null && decks.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
          No Commander decks with a card list yet — build one in My Decks &amp; Lists, then check back after the next daily sync.
        </div>
      )}

      {decks !== null && decks.length > 0 && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Total across {decks.length} decks</p>
            <p className="text-xl font-bold text-amber-400">{fmtUsd(totalAcrossDecks)}</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2 p-4 border-b border-zinc-800">
              <div className="flex items-center gap-1.5">
                {([{ key: 'all', label: 'All' }, { key: 'incomplete', label: 'Missing prices' }] as { key: 'all' | 'incomplete'; label: string }[]).map(f => (
                  <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.key ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                Sort by
                <button type="button" onClick={() => setSort('value_desc')} className={sort === 'value_desc' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Value ↓</button>
                ·
                <button type="button" onClick={() => setSort('value_asc')} className={sort === 'value_asc' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Value ↑</button>
                ·
                <button type="button" onClick={() => setSort('name')} className={sort === 'name' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Name</button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-900">
                  <tr className="text-left text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                    <th className="px-4 py-3 font-medium">Deck</th>
                    <th className="px-4 py-3 font-medium">Cards</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(d => (
                    <tr key={d.deckId} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                      <td className="px-4 py-3">
                        <Link href={`/decks/value/${d.deckId}`} className="hover:text-amber-400 transition-colors">
                          {d.deckName}
                          {d.commander && <span className="text-zinc-500 text-xs"> — {d.commander}</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {d.cardsMatched}/{d.cardCount}
                        {d.cardsMatched < d.cardCount && <span className="text-amber-500 text-xs ml-1">⚠</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-200">{fmtUsd(d.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && <p className="text-xs text-zinc-600 p-4">No decks match this filter.</p>}
            </div>
            <p className="text-[10px] text-zinc-600 p-3 border-t border-zinc-800">{visible.length} of {decks.length} decks shown — scroll within the list above for more.</p>
          </div>
        </>
      )}
    </main>
  );
}
