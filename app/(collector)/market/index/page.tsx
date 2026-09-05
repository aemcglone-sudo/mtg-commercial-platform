'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PriceChart from '@/components/PriceChart';
import BreadthChart from '@/components/BreadthChart';

interface IndexPoint {
  date: string; indexValue: number; cardCount: number;
  advancers: number | null; decliners: number | null; unchanged: number | null; medianReturnPct: number | null;
  concentrationTop10Pct: number | null; concentrationTop100Pct: number | null;
}
interface SetMoverRow { setCode: string; avgUsdNow: number; changePercent: number }
interface Enriched {
  latest: IndexPoint | null;
  volatility: { daily7d: number | null; daily30d: number | null; trend: string | null };
  concentrationHealth: 'healthy' | 'moderate' | 'risky' | null;
  breadthHealth: 'healthy' | 'balanced' | 'weak' | null;
  leadingSets: SetMoverRow[];
  laggingSets: SetMoverRow[];
}

const HEALTH_STYLE: Record<string, string> = {
  healthy: 'text-emerald-400', balanced: 'text-amber-400', moderate: 'text-amber-400',
  weak: 'text-red-400', risky: 'text-red-400', settling: 'text-emerald-400',
  increasing: 'text-red-400', stable: 'text-amber-400',
};

export default function MarketIndexPage() {
  const [points, setPoints] = useState<IndexPoint[] | null>(null);
  const [enriched, setEnriched] = useState<Enriched | null>(null);
  const [setNameByCode, setSetNameByCode] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const [idxRes, enrRes, setsRes] = await Promise.all([
      fetch('/api/market/index').then(r => r.json()),
      fetch('/api/market/index/enriched').then(r => r.json()),
      fetch('/api/market/sets?all=1').then(r => r.json()),
    ]);
    setPoints(idxRes.points ?? []);
    setEnriched(enrRes);
    setSetNameByCode(new Map((setsRes.sets ?? []).map((s: any) => [s.code, s.name])));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setName = useCallback((code: string) => setNameByCode.get(code) ?? code.toUpperCase(), [setNameByCode]);

  const last = points && points.length > 0 ? points[points.length - 1] : null;
  const first = points && points.length > 0 ? points[0] : null;
  const changePct = first && last ? ((last.indexValue - first.indexValue) / first.indexValue) * 100 : null;

  const concentration = enriched?.latest;

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
      <p className="text-xs text-zinc-600 mb-1">
        Not a true market cap — we only have price, not print-run/supply data, so every card counts equally regardless of value.
        History backfills gradually (one historical day added per daily run) rather than all at once, to stay easy on the database.
      </p>
      {last && (
        <p className="text-xs text-zinc-500 mb-6">
          <span className="font-semibold text-zinc-300">Tracking {last.cardCount.toLocaleString()} cards</span> in this index — every card with a price on both {first?.date} and today counts once, equally. (The "top 10 / top 100" numbers below are a separate stat about the priciest individual cards, not the index's size.)
        </p>
      )}

      {/* Quick health metrics */}
      {enriched && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Concentration</p>
            <p className={`text-sm font-semibold capitalize ${enriched.concentrationHealth ? HEALTH_STYLE[enriched.concentrationHealth] : 'text-zinc-500'}`}>
              {enriched.concentrationHealth ?? '—'}
            </p>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              Out of the {last?.cardCount.toLocaleString() ?? 'thousands of'} cards we track, how much of the total dollar value sits in just the {' '}
              <Link href="/market/high-value" className="underline hover:text-amber-400">10 priciest ones</Link>?
              {concentration?.concentrationTop10Pct !== null && concentration?.concentrationTop10Pct !== undefined
                ? ` Right now: ${concentration.concentrationTop10Pct.toFixed(1)}%. Lower is healthier — it means value is spread out, not riding on a handful of chase cards.`
                : ' No data yet.'}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Volatility</p>
            <p className={`text-sm font-semibold capitalize ${enriched.volatility.trend ? HEALTH_STYLE[enriched.volatility.trend] : 'text-zinc-500'}`}>
              {enriched.volatility.trend ?? '—'}
            </p>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              How much the index itself has bounced up and down day to day recently, compared to its longer-run average.
              {enriched.volatility.daily7d !== null
                ? ` Last 7 days it moved about ${enriched.volatility.daily7d.toFixed(2)}% a day on average — "${enriched.volatility.trend}" means that's about the same as its usual swing.`
                : ' Not enough history yet to compare.'}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Breadth</p>
            <p className={`text-sm font-semibold capitalize ${enriched.breadthHealth ? HEALTH_STYLE[enriched.breadthHealth] : 'text-zinc-500'}`}>
              {enriched.breadthHealth ?? '—'}
            </p>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              Of all the cards we track, what fraction went up in price yesterday vs. down?
              {concentration?.advancers !== null && concentration?.advancers !== undefined && concentration?.decliners !== null && concentration?.decliners !== undefined
                ? ` ${((concentration.advancers / (concentration.advancers + concentration.decliners)) * 100).toFixed(0)}% of cards that moved went up. More advancers than decliners = broad-based strength, not just a few cards carrying the average.`
                : ' No data yet.'}
            </p>
          </div>
        </div>
      )}

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

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
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

      {/* Concentration detail */}
      {concentration && (concentration.concentrationTop10Pct !== null || concentration.concentrationTop100Pct !== null) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Concentration — is value spread out or top-heavy?</p>
          <p className="text-xs text-zinc-600 mb-3">
            Add up the price of every card we track (~{last?.cardCount.toLocaleString() ?? 'thousands of'} of them) to get a total dollar figure.
            These bars show what share of that total comes from just the 10 most expensive individual cards, and separately the 100 most expensive —
            not 10 or 100 out of the whole index, just the priciest slice of it.
          </p>
          <div className="space-y-3">
            {concentration.concentrationTop10Pct !== null && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Top 10 cards</span>
                  <span>{concentration.concentrationTop10Pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${Math.min(concentration.concentrationTop10Pct, 100)}%` }} />
                </div>
              </div>
            )}
            {concentration.concentrationTop100Pct !== null && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Top 100 cards</span>
                  <span>{concentration.concentrationTop100Pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-zinc-500" style={{ width: `${Math.min(concentration.concentrationTop100Pct, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Set leaders/laggards */}
      {enriched && (enriched.leadingSets.length > 0 || enriched.laggingSets.length > 0) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Which sets are driving the market (90d)</p>
          <p className="text-xs text-zinc-600 mb-3">
            Each set's average card price, now vs. 90 days ago — the sets whose average moved the most, either direction.
            Only sets with at least 10 tracked cards count (smaller sample sizes are too noisy — a single promo card's price swing shouldn't look like a "set" move), and pure token sets are excluded.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-emerald-500 font-semibold mb-2">Leading</p>
              <div className="space-y-1.5">
                {enriched.leadingSets.map(s => (
                  <Link key={s.setCode} href={`/market/sets/${s.setCode}`} className="flex items-center justify-between gap-2 text-sm hover:text-amber-400 transition-colors">
                    <span className="truncate">{setName(s.setCode)}</span>
                    <span className="text-emerald-400 text-xs shrink-0">▲ {s.changePercent.toFixed(1)}%</span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-red-500 font-semibold mb-2">Lagging</p>
              <div className="space-y-1.5">
                {enriched.laggingSets.map(s => (
                  <Link key={s.setCode} href={`/market/sets/${s.setCode}`} className="flex items-center justify-between gap-2 text-sm hover:text-amber-400 transition-colors">
                    <span className="truncate">{setName(s.setCode)}</span>
                    <span className="text-red-400 text-xs shrink-0">▼ {Math.abs(s.changePercent).toFixed(1)}%</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {points !== null && points.length === 0 && (
        <p className="text-xs text-zinc-600 mt-4">No index data yet — it's computed once a day by the price sync job.</p>
      )}
    </main>
  );
}
