'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Sparkline from '@/components/Sparkline';

interface Event {
  scryfallId: string; category: string; summary: string; sourceUrls: string[]; detectedAt: string;
}
interface HighValueCard {
  scryfallId: string; cardName: string; setCode: string; usd: number; sparkline: number[];
  latestEvent: Event | null;
}

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  reprint: 'Reprint', banned: 'Ban/Unban', tournament: 'Tournament result', set_synergy: 'New set synergy', other: 'News',
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pctChange(sparkline: number[]): number | null {
  if (sparkline.length < 2) return null;
  const first = sparkline[0];
  const last = sparkline[sparkline.length - 1];
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

export default function HighValueCardsPage() {
  const [cards, setCards] = useState<HighValueCard[] | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [setNameByCode, setSetNameByCode] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const [hvRes, setsRes] = await Promise.all([
      fetch('/api/market/high-value').then(r => r.json()),
      fetch('/api/market/sets?all=1').then(r => r.json()),
    ]);
    setCards(hvRes.cards ?? []);
    setComputedAt(hvRes.computedAt ?? null);
    setSetNameByCode(new Map((setsRes.sets ?? []).map((s: any) => [s.code, s.name])));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setName = useCallback((code: string) => setNameByCode.get(code) ?? code.toUpperCase(), [setNameByCode]);

  const cardsWithNews = useMemo(() => (cards ?? []).filter(c => c.latestEvent !== null), [cards]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Highest Value Cards</h1>
          <p className="text-sm text-zinc-500 mt-0.5">The most expensive tracked Magic cards, and what's moving them.</p>
        </div>
        <Link href="/market" className="text-xs text-amber-400 hover:text-amber-300">← Back to Market</Link>
      </div>
      <p className="text-xs text-zinc-600 mb-6">
        Ranked by current price across the whole tracked catalog (not one set) — the true "blue chips" of Magic, mostly Power Nine and other old Reserved List staples.
        {computedAt && ` Last updated ${new Date(computedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`}
      </p>

      {cardsWithNews.length > 0 && (
        <div className="bg-sky-950/20 border border-sky-900/50 rounded-xl p-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-sky-400 font-semibold mb-2">Recent news among these cards</p>
          <div className="space-y-2">
            {cardsWithNews.slice(0, 5).map(c => (
              <div key={c.scryfallId} className="text-sm">
                <span className="text-sky-400 text-xs font-medium mr-1.5">{EVENT_CATEGORY_LABELS[c.latestEvent!.category] ?? c.latestEvent!.category}</span>
                <Link href={`/market/card/${c.scryfallId}`} className="hover:text-amber-400 transition-colors font-medium">{c.cardName}</Link>
                <span className="text-zinc-400"> — {c.latestEvent!.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cards === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {cards !== null && cards.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
          No data yet — it's computed once a day by the price sync job.
        </div>
      )}

      {cards !== null && cards.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">30d trend</th>
                  <th className="px-4 py-3 font-medium">30d change</th>
                  <th className="px-4 py-3 font-medium">News</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c, i) => {
                  const change = pctChange(c.sparkline);
                  return (
                    <tr key={c.scryfallId} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                      <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/market/card/${c.scryfallId}`} className="hover:text-amber-400 transition-colors">
                          {c.cardName}
                          <span className="text-zinc-500 text-xs"> — {setName(c.setCode)}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-200 font-medium">{fmtUsd(c.usd)}</td>
                      <td className="px-4 py-3">
                        {c.sparkline.length >= 2
                          ? <Sparkline values={c.sparkline} positive={(change ?? 0) >= 0} width={100} height={24} />
                          : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {change !== null ? (
                          <span className={`text-xs font-semibold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                          </span>
                        ) : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 max-w-[220px]">
                        {c.latestEvent ? (
                          <span title={c.latestEvent.summary} className="text-sky-400">
                            {EVENT_CATEGORY_LABELS[c.latestEvent.category] ?? c.latestEvent.category}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
