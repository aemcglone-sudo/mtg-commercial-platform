'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import AsOfDate from '@/components/AsOfDate';

interface FoilPremiumRow { setCode: string; avgNonfoil: number; avgFoil: number; premiumPct: number; cardCount: number }

type Filter = 'all' | 'inverted' | 'high';
type Sort = 'premium_desc' | 'premium_asc' | 'name';

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function FoilPremiumPage() {
  const [table, setTable] = useState<FoilPremiumRow[] | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [setNameByCode, setSetNameByCode] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('premium_desc');

  const load = useCallback(async () => {
    const [fpRes, setsRes] = await Promise.all([
      fetch('/api/market/foil-premium').then(r => r.json()),
      fetch('/api/market/sets?all=1').then(r => r.json()),
    ]);
    setTable(fpRes.table ?? []);
    setComputedAt(fpRes.computedAt ?? null);
    setSetNameByCode(new Map((setsRes.sets ?? []).map((s: any) => [s.code, s.name])));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setName = useCallback((code: string) => setNameByCode.get(code) ?? code.toUpperCase(), [setNameByCode]);

  const visible = useMemo(() => {
    if (!table) return [];
    let rows = table;
    if (filter === 'inverted') rows = rows.filter(r => r.premiumPct < 0);
    if (filter === 'high') rows = rows.filter(r => r.premiumPct > 100);
    rows = [...rows].sort((a, b) => {
      if (sort === 'premium_desc') return b.premiumPct - a.premiumPct;
      if (sort === 'premium_asc') return a.premiumPct - b.premiumPct;
      return setName(a.setCode).localeCompare(setName(b.setCode));
    });
    return rows;
  }, [table, filter, sort, setName]);

  const invertedCount = useMemo(() => table?.filter(r => r.premiumPct < 0).length ?? 0, [table]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Foil Premium</h1>
          <p className="text-sm text-zinc-500 mt-0.5">How much more (or less) foil copies sell for than nonfoil, by set.</p>
        </div>
        <BackButton fallbackHref="/market" />
      </div>
      <AsOfDate date={computedAt ? computedAt.slice(0, 10) : null} label="Computed as of" />
      <p className="text-xs text-zinc-600 mt-1 mb-6">
        Average foil price ÷ average nonfoil price, per set (sets with at least 10 cards carrying both prices — smaller samples are too noisy).
        Usually foil trades well above nonfoil — old-frame foils from vintage-relevant sets can run 10-20x — but it inverts for a handful of
        sets, where foil is actually the <em>cheaper</em> copy.{invertedCount > 0 && ` ${invertedCount} set${invertedCount === 1 ? '' : 's'} currently invert${invertedCount === 1 ? 's' : ''}.`}
      </p>

      {table === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {table !== null && table.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
          No data yet — it's computed once a day by the price sync job.
        </div>
      )}

      {table !== null && table.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2 p-4 border-b border-zinc-800">
            <div className="flex items-center gap-1.5">
              {([
                { key: 'all', label: 'All' },
                { key: 'inverted', label: 'Inverted' },
                { key: 'high', label: '>100% premium' },
              ] as { key: Filter; label: string }[]).map(f => (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.key ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              Sort by
              <button type="button" onClick={() => setSort('premium_desc')} className={sort === 'premium_desc' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Premium ↓</button>
              ·
              <button type="button" onClick={() => setSort('premium_asc')} className={sort === 'premium_asc' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Premium ↑</button>
              ·
              <button type="button" onClick={() => setSort('name')} className={sort === 'name' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Name</button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                  <th className="px-4 py-3 font-medium">Set</th>
                  <th className="px-4 py-3 font-medium">Nonfoil</th>
                  <th className="px-4 py-3 font-medium">Foil</th>
                  <th className="px-4 py-3 font-medium">Premium</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.setCode} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      <Link href={`/market/sets/${r.setCode}`} className="hover:text-amber-400 transition-colors">
                        {setName(r.setCode)}
                        <span className="text-zinc-600 text-xs"> ({r.cardCount})</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{fmtUsd(r.avgNonfoil)}</td>
                    <td className="px-4 py-3 text-zinc-400">{fmtUsd(r.avgFoil)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${r.premiumPct < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {r.premiumPct >= 0 ? '+' : ''}{r.premiumPct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p className="text-xs text-zinc-600 p-4">No sets match this filter.</p>}
          </div>
          <p className="text-[10px] text-zinc-600 p-3 border-t border-zinc-800">{visible.length} of {table.length} sets shown — scroll within the list above for more.</p>
        </div>
      )}
    </main>
  );
}
