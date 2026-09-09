'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import AsOfDate from '@/components/AsOfDate';

interface PopularityPriceRow {
  cardName: string;
  scryfallId: string | null;
  commanderName: string;
  commanderSlug: string;
  inclusionRate: number;
  numDecks: number;
  priceUsd: number | null;
  priceDate: string | null;
  earliestInclusionRate: number | null;
  earliestDate: string | null;
  inclusionRateChangePct: number | null;
  priceChangePct: number | null;
  daysTracked: number;
}

type Sort = 'inclusion_desc' | 'price_desc' | 'inclusion_change_desc' | 'price_change_desc' | 'name';
type Filter = 'all' | 'rising_popularity' | 'has_history';

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export default function PopularityVsPricePage() {
  const [rows, setRows] = useState<PopularityPriceRow[] | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('inclusion_desc');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    const res = await fetch('/api/market/popularity').then(r => r.json());
    setRows(res.rows ?? []);
    setComputedAt(res.computedAt ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxDaysTracked = useMemo(() => rows && rows.length > 0 ? Math.max(...rows.map(r => r.daysTracked)) : 0, [rows]);

  const visible = useMemo(() => {
    if (!rows) return [];
    let out = rows;
    if (filter === 'rising_popularity') out = out.filter(r => r.inclusionRateChangePct !== null && r.inclusionRateChangePct > 0);
    if (filter === 'has_history') out = out.filter(r => r.inclusionRateChangePct !== null);
    out = [...out].sort((a, b) => {
      if (sort === 'inclusion_desc') return b.inclusionRate - a.inclusionRate;
      if (sort === 'price_desc') return (b.priceUsd ?? -1) - (a.priceUsd ?? -1);
      if (sort === 'inclusion_change_desc') return (b.inclusionRateChangePct ?? -Infinity) - (a.inclusionRateChangePct ?? -Infinity);
      if (sort === 'price_change_desc') return (b.priceChangePct ?? -Infinity) - (a.priceChangePct ?? -Infinity);
      return a.cardName.localeCompare(b.cardName);
    });
    return out;
  }, [rows, filter, sort]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Popularity vs Price</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Does a card's EDHREC inclusion rate moving predict its price moving?</p>
        </div>
        <BackButton fallbackHref="/market" />
      </div>
      <AsOfDate date={computedAt ? computedAt.slice(0, 10) : null} label="Computed as of" />
      <p className="text-xs text-zinc-600 mt-1 mb-6">
        We snapshot EDHREC's per-commander card inclusion rate daily for ~20 popular commanders and track it alongside each
        card's tracked price. {maxDaysTracked <= 1
          ? "Tracking just started — change columns will fill in as more days accumulate. Check back in a week or two for a real trend."
          : `Change columns compare today against each card's earliest snapshot in the last 30 days (up to ${maxDaysTracked} day${maxDaysTracked === 1 ? '' : 's'} of history so far).`}
        {' '}Price is the cheapest tracked printing by name (not a specific printing), same proxy used elsewhere on this site.
      </p>

      {rows === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {rows !== null && rows.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
          No popularity data yet — it's computed once a day by the price sync job.
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2 p-4 border-b border-zinc-800">
            <div className="flex items-center gap-1.5">
              {([
                { key: 'all', label: 'All' },
                { key: 'rising_popularity', label: 'Rising popularity' },
                { key: 'has_history', label: 'Has history' },
              ] as { key: Filter; label: string }[]).map(f => (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.key ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 flex-wrap">
              Sort by
              <button type="button" onClick={() => setSort('inclusion_desc')} className={sort === 'inclusion_desc' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Inclusion rate</button>
              ·
              <button type="button" onClick={() => setSort('price_desc')} className={sort === 'price_desc' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Price</button>
              ·
              <button type="button" onClick={() => setSort('inclusion_change_desc')} className={sort === 'inclusion_change_desc' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Popularity Δ</button>
              ·
              <button type="button" onClick={() => setSort('price_change_desc')} className={sort === 'price_change_desc' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Price Δ</button>
              ·
              <button type="button" onClick={() => setSort('name')} className={sort === 'name' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Name</button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">Commander</th>
                  <th className="px-4 py-3 font-medium">Inclusion</th>
                  <th className="px-4 py-3 font-medium">Popularity Δ</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Price Δ</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={`${r.commanderSlug}|${r.cardName}`} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      {r.scryfallId ? (
                        <Link href={`/market/card/${r.scryfallId}`} className="hover:text-amber-400 transition-colors text-zinc-200">
                          {r.cardName}
                        </Link>
                      ) : (
                        <span className="text-zinc-200">{r.cardName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{r.commanderName}</td>
                    <td className="px-4 py-3 text-zinc-400">{(r.inclusionRate * 100).toFixed(0)}%</td>
                    <td className={`px-4 py-3 font-medium ${r.inclusionRateChangePct === null ? 'text-zinc-600' : r.inclusionRateChangePct > 0 ? 'text-emerald-400' : r.inclusionRateChangePct < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                      {r.inclusionRateChangePct === null ? '—' : fmtPct(r.inclusionRateChangePct)}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{r.priceUsd !== null ? fmtUsd(r.priceUsd) : '—'}</td>
                    <td className={`px-4 py-3 font-medium ${r.priceChangePct === null ? 'text-zinc-600' : r.priceChangePct > 0 ? 'text-emerald-400' : r.priceChangePct < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                      {r.priceChangePct === null ? '—' : fmtPct(r.priceChangePct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p className="text-xs text-zinc-600 p-4">No cards match this filter.</p>}
          </div>
          <p className="text-[10px] text-zinc-600 p-3 border-t border-zinc-800">{visible.length} of {rows.length} cards shown — scroll within the list above for more.</p>
        </div>
      )}
    </main>
  );
}
