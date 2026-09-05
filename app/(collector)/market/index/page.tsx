'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PriceChart from '@/components/PriceChart';
import BreadthChart from '@/components/BreadthChart';

interface IndexPoint {
  date: string; indexValue: number; cardCount: number;
  advancers: number | null; decliners: number | null; unchanged: number | null; medianReturnPct: number | null;
}

export default function MarketIndexPage() {
  const [points, setPoints] = useState<IndexPoint[] | null>(null);

  useEffect(() => {
    fetch('/api/market/index').then(r => r.json()).then(d => setPoints(d.points ?? []));
  }, []);

  const last = points && points.length > 0 ? points[points.length - 1] : null;
  const first = points && points.length > 0 ? points[0] : null;
  const changePct = first && last ? ((last.indexValue - first.indexValue) / first.indexValue) * 100 : null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-zinc-100">
      <Link href="/market" className="text-xs text-zinc-500 hover:text-zinc-300">← Back to Market</Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Market Index</h1>
          <p className="text-sm text-zinc-500">
            Equal-weighted average of every tracked card's price, normalized to 100 on {first?.date ?? '—'}.
          </p>
        </div>
        {last && (
          <div className="text-right">
            <p className="text-lg font-bold">{last.indexValue.toFixed(1)}</p>
            {changePct !== null && (
              <p className={`text-xs font-semibold ${changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}% since inception
              </p>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-600 mb-6">
        Not a true market cap — we only have price, not print-run/supply data, so every card counts equally regardless of value.
        History backfills gradually (one historical day added per daily run) rather than all at once, to stay easy on the database.
      </p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">Index value over time</p>
        {points === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <PriceChart
            points={points.map(p => ({ date: p.date, value: p.indexValue }))}
            height={220}
            formatValue={v => v.toFixed(1)}
            unitLabel="Index value (base 100)"
          />
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Breadth — advancers vs. decliners each day</p>
        <p className="text-xs text-zinc-600 mb-3">
          A rising index with mostly-green bars is broad-based growth. A flat index with tall bars on both sides means value is rotating between cards, not disappearing or accumulating.
        </p>
        {points === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <BreadthChart points={points} height={120} />
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Advancers</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Decliners</span>
        </div>
      </div>

      {points !== null && points.length === 0 && (
        <p className="text-xs text-zinc-600 mt-4">No index data yet — it's computed once a day by the price sync job.</p>
      )}
    </main>
  );
}
