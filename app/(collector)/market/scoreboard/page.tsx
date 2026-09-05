'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

interface ScoreboardRow {
  scryfallId: string;
  cardName: string;
  setCode: string;
  predictionDirection: string;
  confidencePct: number;
  currentPrice: number;
  targetPrice6m: number;
  matchedPattern: string;
}

type Direction = 'bullish' | 'bearish' | 'neutral';
type Sort = 'confidence' | 'price';

const DIRECTIONS: { key: Direction; label: string; style: string }[] = [
  { key: 'bullish', label: 'Bullish', style: 'text-emerald-400' },
  { key: 'bearish', label: 'Bearish', style: 'text-red-400' },
  { key: 'neutral', label: 'Neutral', style: 'text-zinc-400' },
];

const PATTERN_LABELS: Record<string, string> = {
  hype_spike_fade: 'Hype Spike Fade',
  supply_flood_continuation: 'Supply Flood Continuation',
  stabilization_hold: 'Stabilization Hold',
  undervalued_in_set: 'Undervalued In Set',
  overextended_in_set: 'Overextended In Set',
  fallback_neutral: 'No Strong Pattern',
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function ScoreboardPage() {
  const [direction, setDirection] = useState<Direction>('bullish');
  const [sort, setSort] = useState<Sort>('confidence');
  const [rows, setRows] = useState<ScoreboardRow[] | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<{ code: string; name: string }[]>([]);

  const setNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sets) map.set(s.code, s.name);
    return map;
  }, [sets]);
  const setName = useCallback((code: string) => setNameByCode.get(code) ?? code.toUpperCase(), [setNameByCode]);

  useEffect(() => {
    fetch('/api/market/sets?all=1').then(r => r.json()).then(d => setSets((d.sets ?? []).map((s: any) => ({ code: s.code, name: s.name }))));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/market/scoreboard?direction=${direction}&sort=${sort}`).then(r => r.json());
    setRows(res.rows ?? []);
    setTimedOut(!!res.timedOut);
    setLoading(false);
  }, [direction, sort]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Speculation Scoreboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Every card's 6-month prediction, side by side.</p>
        </div>
        <Link href="/market" className="text-xs text-amber-400 hover:text-amber-300">← Back to Market</Link>
      </div>
      <p className="text-xs text-zinc-600 mb-6">
        Heuristic pattern-match calls, not backtested accuracy — no prediction has had 6 months to resolve yet.
      </p>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          {DIRECTIONS.map(d => (
            <button key={d.key} type="button" onClick={() => setDirection(d.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${direction === d.key ? 'bg-amber-400 text-black' : `bg-zinc-900 border border-zinc-800 ${d.style}`}`}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-zinc-500 mr-1">Sort by</span>
          <button type="button" onClick={() => setSort('confidence')}
            className={`px-2.5 py-1 rounded ${sort === 'confidence' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
            Confidence
          </button>
          <button type="button" onClick={() => setSort('price')}
            className={`px-2.5 py-1 rounded ${sort === 'price' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
            Price
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && timedOut && (
        <div className="bg-red-950/30 border border-red-900 rounded-xl p-6 text-center text-sm text-red-300">
          Couldn't load the scoreboard — the request timed out. Try again in a moment.
        </div>
      )}

      {!loading && !timedOut && rows && rows.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
          No {direction} predictions right now — check back after the next daily run.
        </div>
      )}

      {!loading && !timedOut && rows && rows.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">Current</th>
                  <th className="px-4 py-3 font-medium">6mo target</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Pattern</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.scryfallId} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      <Link href={`/market/card/${r.scryfallId}`} className="hover:text-amber-400 transition-colors">
                        {r.cardName}
                        <span className="text-zinc-500 text-xs"> — {setName(r.setCode)}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{fmtUsd(r.currentPrice)}</td>
                    <td className="px-4 py-3 text-zinc-300">{fmtUsd(r.targetPrice6m)}</td>
                    <td className="px-4 py-3 text-zinc-300">{r.confidencePct.toFixed(0)}%</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{PATTERN_LABELS[r.matchedPattern] ?? r.matchedPattern}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
