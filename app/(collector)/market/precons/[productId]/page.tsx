'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import AsOfDate from '@/components/AsOfDate';

interface PreconCardValue { scryfallId: string; cardName: string; qty: number; foilOnly: boolean; unitPrice: number | null; lineValue: number | null }
interface PreconValue {
  productId: string; productName: string; setCode: string; commander: string | null;
  totalValue: number; cardCount: number; cardsMatched: number; cards: PreconCardValue[];
}

type Sort = 'value_desc' | 'value_asc' | 'name';

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function PreconValueDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;
  const [value, setValue] = useState<PreconValue | null | undefined>(undefined);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('value_desc');
  const [filter, setFilter] = useState<'all' | 'missing'>('all');

  const load = useCallback(async () => {
    const res = await fetch(`/api/market/precons/${productId}`).then(r => r.json());
    setValue(res.value ?? null);
    setComputedAt(res.computedAt ?? null);
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (!value) return [];
    let rows = filter === 'missing' ? value.cards.filter(c => c.unitPrice === null) : value.cards;
    rows = [...rows].sort((a, b) => {
      if (sort === 'value_desc') return (b.lineValue ?? -1) - (a.lineValue ?? -1);
      if (sort === 'value_asc') return (a.lineValue ?? Infinity) - (b.lineValue ?? Infinity);
      return a.cardName.localeCompare(b.cardName);
    });
    return rows;
  }, [value, filter, sort]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">{value?.productName ?? 'Precon Deck'}</h1>
          {value?.commander && <p className="text-sm text-zinc-500 mt-0.5">Commander: {value.commander}</p>}
          {value?.setCode && <p className="text-xs text-zinc-600 uppercase">{value.setCode}</p>}
        </div>
        <BackButton fallbackHref="/market/precons" />
      </div>
      <AsOfDate date={computedAt ? computedAt.slice(0, 10) : null} label="Computed as of" />

      {value === undefined && <p className="text-sm text-zinc-500 mt-6">Loading…</p>}
      {value === null && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400 mt-6">
          No value data yet for this deck — check back after the next daily sync.
        </div>
      )}

      {value && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 my-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Sum-of-singles value</p>
            <p className="text-2xl font-bold text-amber-400">{fmtUsd(value.totalValue)}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {value.cardsMatched} of {value.cardCount} cards priced (exact printings from this product)
              {value.cardsMatched < value.cardCount && ' — the rest have no tracked snapshot yet'}.
              Not the sealed box's actual market price — we don't have a sealed-product data source.
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2 p-4 border-b border-zinc-800">
              <div className="flex items-center gap-1.5">
                {([{ key: 'all', label: 'All' }, { key: 'missing', label: 'Missing price' }] as { key: 'all' | 'missing'; label: string }[]).map(f => (
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
                    <th className="px-4 py-3 font-medium">Card</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(c => (
                    <tr key={c.scryfallId} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                      <td className="px-4 py-3">
                        <Link href={`/market/card/${c.scryfallId}`} className="hover:text-amber-400 transition-colors text-zinc-200">
                          {c.cardName}
                        </Link>
                        {c.foilOnly && <span className="text-amber-500 text-[10px] ml-1.5">FOIL</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{c.qty}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.unitPrice !== null ? fmtUsd(c.unitPrice) : '—'}</td>
                      <td className="px-4 py-3 font-medium text-zinc-200">{c.lineValue !== null ? fmtUsd(c.lineValue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && <p className="text-xs text-zinc-600 p-4">No cards match this filter.</p>}
            </div>
            <p className="text-[10px] text-zinc-600 p-3 border-t border-zinc-800">{visible.length} of {value.cards.length} cards shown — scroll within the list above for more.</p>
          </div>
        </>
      )}
    </main>
  );
}
