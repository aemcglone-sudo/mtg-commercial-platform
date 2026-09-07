'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import ComparisonChart from '@/components/ComparisonChart';
import AsOfDate from '@/components/AsOfDate';
import BackButton from '@/components/BackButton';

interface Holding {
  scryfallId: string; cardName: string | null; setCode: string | null; usd: number | null; qty: number;
  positionValue: number | null; predictionDirection: string | null; confidencePct: number | null;
  targetPrice6m: number | null; matchedPattern: string | null;
}
interface PortfolioSummary {
  totalValue: number; cardsOwned: number; cardsPriced: number;
  bullishCount: number; bearishCount: number; neutralCount: number;
  holdings: Holding[]; history: { date: string; value: number; cardsPriced: number }[];
}
interface IndexPoint { date: string; indexValue: number }

type Filter = 'all' | 'bullish' | 'bearish';
type Sort = 'value' | 'confidence';

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const DIRECTION_STYLE: Record<string, string> = {
  bullish: 'text-emerald-400', bearish: 'text-red-400', neutral: 'text-zinc-500',
};

export default function PortfolioPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null | undefined>(undefined);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [indexPoints, setIndexPoints] = useState<IndexPoint[]>([]);
  const [setNameByCode, setSetNameByCode] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('value');

  const load = useCallback(async () => {
    const [pRes, idxRes, setsRes] = await Promise.all([
      fetch('/api/portfolio/summary').then(r => r.json()),
      fetch('/api/market/index').then(r => r.json()),
      fetch('/api/market/sets?all=1').then(r => r.json()),
    ]);
    setSummary(pRes.summary ?? null);
    setComputedAt(pRes.computedAt ?? null);
    setIndexPoints(idxRes.points ?? []);
    setSetNameByCode(new Map((setsRes.sets ?? []).map((s: any) => [s.code, s.name])));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setName = useCallback((code: string | null) => code ? (setNameByCode.get(code) ?? code.toUpperCase()) : '—', [setNameByCode]);

  const visibleHoldings = useMemo(() => {
    if (!summary) return [];
    let rows = summary.holdings.filter(h => h.usd !== null);
    if (filter !== 'all') rows = rows.filter(h => h.predictionDirection === filter);
    rows = [...rows].sort((a, b) => sort === 'value'
      ? (b.positionValue ?? 0) - (a.positionValue ?? 0)
      : (b.confidencePct ?? 0) - (a.confidencePct ?? 0));
    return rows.slice(0, 100);
  }, [summary, filter, sort]);

  const chartSeries = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'My Portfolio', color: '#fbbf24', points: summary.history.map(h => ({ date: h.date, value: h.value })) },
      { label: 'Market Index', color: '#60a5fa', points: indexPoints.map(p => ({ date: p.date, value: p.indexValue })) },
    ];
  }, [summary, indexPoints]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">My Portfolio</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Your collection's tracked value, benchmarked against the overall Market Index.</p>
        </div>
        <BackButton fallbackHref="/" />
      </div>
      <AsOfDate date={computedAt ? computedAt.slice(0, 10) : null} label="Portfolio computed as of" />

      {summary === undefined && <p className="text-sm text-zinc-500 mt-6">Loading…</p>}

      {summary === null && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400 mt-6">
          No portfolio data yet — add cards to your collection with a matched printing, then check back after the next daily sync.
        </div>
      )}

      {summary && (
        <>
          <p className="text-xs text-zinc-600 mt-1 mb-6">
            {summary.cardsPriced} of {summary.cardsOwned} owned cards are price-tracked
            {summary.cardsOwned > summary.cardsPriced && ` — the rest don't have a matched printing or tracked price yet, so they're excluded from the total below`}.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Total Value</p>
              <p className="text-xl font-bold text-zinc-100">{fmtUsd(summary.totalValue)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wide text-emerald-500 mb-1">Bullish</p>
              <p className="text-xl font-bold text-zinc-100">{summary.bullishCount}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Neutral</p>
              <p className="text-xl font-bold text-zinc-100">{summary.neutralCount}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wide text-red-500 mb-1">Bearish</p>
              <p className="text-xl font-bold text-zinc-100">{summary.bearishCount}</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Portfolio vs. Market (indexed to 100 at each line's own start)</p>
            <p className="text-xs text-zinc-600 mb-3">
              Early portfolio value understates the true total — before full-catalog price tracking began (~Sept 3), only some of your
              collection had a tracked price, so the line grows partly because coverage grew, not just because value did.
            </p>
            <ComparisonChart series={chartSeries} height={240} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2 p-4 border-b border-zinc-800">
              <div className="flex items-center gap-1.5">
                {(['all', 'bullish', 'bearish'] as Filter[]).map(f => (
                  <button key={f} type="button" onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                Sort by
                <button type="button" onClick={() => setSort('value')} className={sort === 'value' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Value</button>
                ·
                <button type="button" onClick={() => setSort('confidence')} className={sort === 'confidence' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Confidence</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                    <th className="px-4 py-3 font-medium">Card</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Position</th>
                    <th className="px-4 py-3 font-medium">6m Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHoldings.map(h => (
                    <tr key={h.scryfallId} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                      <td className="px-4 py-3">
                        <Link href={`/market/card/${h.scryfallId}`} className="hover:text-amber-400 transition-colors">
                          {h.cardName}
                          <span className="text-zinc-500 text-xs"> — {setName(h.setCode)}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{h.qty}</td>
                      <td className="px-4 py-3 text-zinc-400">{h.usd !== null ? fmtUsd(h.usd) : '—'}</td>
                      <td className="px-4 py-3 font-medium text-zinc-200">{h.positionValue !== null ? fmtUsd(h.positionValue) : '—'}</td>
                      <td className="px-4 py-3">
                        {h.predictionDirection ? (
                          <span className={`text-xs font-semibold capitalize ${DIRECTION_STYLE[h.predictionDirection]}`}>
                            {h.predictionDirection}
                          </span>
                        ) : <span className="text-zinc-600 text-xs">—</span>}
                        {h.confidencePct !== null && <span className="text-zinc-600 text-xs"> · {h.confidencePct.toFixed(0)}%</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleHoldings.length === 0 && (
              <p className="text-xs text-zinc-600 p-4">No holdings match this filter.</p>
            )}
            <p className="text-[10px] text-zinc-600 p-3">Showing top {visibleHoldings.length} of {summary.holdings.filter(h => h.usd !== null && (filter === 'all' || h.predictionDirection === filter)).length} matching holdings.</p>
          </div>
        </>
      )}
    </main>
  );
}
