'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import AsOfDate from '@/components/AsOfDate';

interface PreconValueSummary { productId: string; productName: string; setCode: string; commander: string | null; totalValue: number; cardCount: number; cardsMatched: number }

type Sort = 'value_desc' | 'value_asc' | 'name';

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PreconValuesPage() {
  const [products, setProducts] = useState<PreconValueSummary[] | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('value_desc');
  const [filter, setFilter] = useState<'all' | 'incomplete'>('all');

  const load = useCallback(async () => {
    const res = await fetch('/api/market/precons').then(r => r.json());
    setProducts(res.products ?? []);
    setComputedAt(res.computedAt ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (!products) return [];
    let rows = filter === 'incomplete' ? products.filter(p => p.cardsMatched < p.cardCount) : products;
    rows = [...rows].sort((a, b) => {
      if (sort === 'value_desc') return b.totalValue - a.totalValue;
      if (sort === 'value_asc') return a.totalValue - b.totalValue;
      return a.productName.localeCompare(b.productName);
    });
    return rows;
  }, [products, filter, sort]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Precon Deck Values</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Every official Commander precon ever released — Fallout, LOTR, Edge of Eternities, all of them.</p>
        </div>
        <BackButton fallbackHref="/market" />
      </div>
      <AsOfDate date={computedAt ? computedAt.slice(0, 10) : null} label="Computed as of" />
      <p className="text-xs text-zinc-600 mt-1 mb-6">
        Not the sealed box's actual resale price — we have no real sealed-product price source (that's a different market than individual
        card prices, which is all Scryfall tracks). This sums each deck's exact cards at their current tracked price — "what these specific
        cards are worth individually," which a sealed box can trade above or below depending on collector/convenience demand.
      </p>

      {products === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {products !== null && products.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
          No precon data yet — it's computed once a day by the price sync job.
        </div>
      )}

      {products !== null && products.length > 0 && (
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
                  <th className="px-4 py-3 font-medium">Set</th>
                  <th className="px-4 py-3 font-medium">Cards</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => (
                  <tr key={p.productId} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      <Link href={`/market/precons/${p.productId}`} className="hover:text-amber-400 transition-colors">
                        {p.productName}
                        {p.commander && <span className="text-zinc-500 text-xs"> — {p.commander}</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs uppercase">{p.setCode}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {p.cardsMatched}/{p.cardCount}
                      {p.cardsMatched < p.cardCount && <span className="text-amber-500 text-xs ml-1">⚠</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-200">{fmtUsd(p.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p className="text-xs text-zinc-600 p-4">No decks match this filter.</p>}
          </div>
          <p className="text-[10px] text-zinc-600 p-3 border-t border-zinc-800">{visible.length} of {products.length} decks shown — scroll within the list above for more.</p>
        </div>
      )}
    </main>
  );
}
