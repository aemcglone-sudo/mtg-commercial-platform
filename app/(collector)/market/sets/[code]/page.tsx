'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PriceChart from '@/components/PriceChart';
import SetPredictionCard from '@/components/SetPredictionCard';

interface SetIndexPoint { date: string; avgUsd: number | null; cardCount: number; }
interface SetMeta { code: string; name: string; setType: string; releasedAt: string | null; cardCount: number; iconSvgUri: string | null; }
interface TopCard { scryfallId: string; cardName: string; usd: number }
interface SetEvent {
  id: string; scryfallId: string; cardName: string; category: string; summary: string;
  sourceUrls: string[]; detectedAt: string;
}
interface SetPredictionRow {
  scryfallId: string; cardName: string; currentPrice: number; targetPrice6m: number | null;
  confidencePct: number; predictionDirection: string; matchedPattern: string;
}
interface SetPrediction {
  totalCards: number; bullishCount: number; bearishCount: number; neutralCount: number;
  avgTargetPct: number | null; avgConfidencePct: number | null; direction: string;
  chaseConcentrationPct: number | null; bullCase: string; bearCase: string;
  topBullish: SetPredictionRow[]; topBearish: SetPredictionRow[]; topValue: SetPredictionRow[];
}

const WINDOWS = [7, 30, 90];

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  reprint: 'Reprint', banned: 'Ban/Unban', tournament: 'Tournament result', set_synergy: 'New set synergy', other: 'News',
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function SetDetailPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const [days, setDays] = useState(90);
  const [points, setPoints] = useState<SetIndexPoint[] | null>(null);
  const [watched, setWatched] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [meta, setMeta] = useState<SetMeta | null>(null);
  const [topCards, setTopCards] = useState<TopCard[] | null>(null);
  const [events, setEvents] = useState<SetEvent[] | null>(null);
  const [prediction, setPrediction] = useState<SetPrediction | null | undefined>(undefined);

  const load = useCallback(async () => {
    const [histRes, setsRes, watchRes, detailRes] = await Promise.all([
      fetch(`/api/market/sets/${code}/history?days=${days}`).then(r => r.json()),
      fetch('/api/market/sets?all=1').then(r => r.json()),
      fetch('/api/market/watchlist').then(r => r.json()),
      fetch(`/api/market/sets/${code}/detail`).then(r => r.json()),
    ]);
    setPoints(histRes.points ?? []);
    const found = setsRes.sets?.find((s: any) => s.code === code) ?? null;
    setMeta(found);
    const item = watchRes.items?.find((w: any) => w.kind === 'set' && w.setCode === code);
    setWatched(!!item);
    setWatchId(item?.id ?? null);
    setTopCards(detailRes.topCards ?? []);
    setEvents(detailRes.events ?? []);
    setPrediction(detailRes.prediction ?? null);
  }, [code, days]);

  useEffect(() => { load(); }, [load]);

  async function toggleWatch() {
    if (watched && watchId) {
      await fetch(`/api/market/watchlist/${watchId}`, { method: 'DELETE' });
      setWatched(false);
      setWatchId(null);
    } else {
      await fetch('/api/market/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'set', setCode: code, setName: meta?.name ?? code.toUpperCase() }),
      });
      load();
    }
  }

  const chartPoints = (points ?? []).map(p => ({ date: p.date, value: p.avgUsd }));
  const first = chartPoints.find(p => p.value !== null)?.value ?? null;
  const last = [...chartPoints].reverse().find(p => p.value !== null)?.value ?? null;
  const changePct = first && last ? ((last - first) / first) * 100 : null;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-zinc-100">
      <Link href="/market" className="text-xs text-zinc-500 hover:text-zinc-300">← Back to Market</Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-3 mb-6">
        <div className="flex items-center gap-3">
          {meta?.iconSvgUri && <img src={meta.iconSvgUri} alt="" className="w-6 h-6 invert opacity-80" />}
          <div>
            <h1 className="text-2xl font-bold">{meta?.name ?? code.toUpperCase()}</h1>
            <p className="text-sm text-zinc-500">{code.toUpperCase()} · Set price index (average card price)</p>
          </div>
        </div>
        <button type="button" onClick={toggleWatch}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${watched ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-300 border border-zinc-700'}`}>
          {watched ? '★ Watching' : '☆ Watch'}
        </button>
      </div>

      {prediction && (
        <div className="mb-6">
          <SetPredictionCard prediction={prediction} />
        </div>
      )}
      {prediction === null && (
        <p className="text-xs text-zinc-600 mb-6">No predictions yet for cards in this set — check back after the next daily run.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left panel — set details */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">Set details</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Released</span>
                <span className="text-zinc-200">
                  {meta?.releasedAt ? new Date(meta.releasedAt + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Cards in set</span>
                <span className="text-zinc-200">{meta?.cardCount ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Set type</span>
                <span className="text-zinc-200 capitalize">{meta?.setType?.replace('_', ' ') ?? '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">High value cards</p>
            {topCards === null && <p className="text-xs text-zinc-600">Loading…</p>}
            {topCards !== null && topCards.length === 0 && <p className="text-xs text-zinc-600">No tracked price data yet.</p>}
            <div className="space-y-1.5">
              {topCards?.map(c => (
                <Link key={c.scryfallId} href={`/market/card/${c.scryfallId}`}
                  className="flex items-center justify-between gap-2 text-sm hover:text-amber-400 transition-colors">
                  <span className="truncate">{c.cardName}</span>
                  <span className="text-zinc-500 text-xs shrink-0">{fmtUsd(c.usd)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">Set news</p>
            {events === null && <p className="text-xs text-zinc-600">Loading…</p>}
            {events !== null && events.length === 0 && (
              <p className="text-xs text-zinc-600">No detected news yet for cards in this set.</p>
            )}
            <div className="space-y-3">
              {events?.map(e => (
                <div key={e.id} className="border-l-2 border-sky-800 pl-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-0.5">
                    <span className="text-sky-400 font-medium">{EVENT_CATEGORY_LABELS[e.category] ?? e.category}</span>
                    <span>·</span>
                    <span className="truncate">{e.cardName}</span>
                  </div>
                  <p className="text-xs text-zinc-300">{e.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — price chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              {WINDOWS.map(w => (
                <button key={w} type="button" onClick={() => setDays(w)}
                  className={`px-2.5 py-1 rounded text-xs ${days === w ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {w}d
                </button>
              ))}
            </div>
            {last !== null && (
              <div className="text-right">
                <p className="text-lg font-bold">${last.toFixed(2)}</p>
                {changePct !== null && (
                  <p className={`text-xs font-semibold ${changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}% over {days}d
                  </p>
                )}
              </div>
            )}
          </div>
          {points === null ? <p className="text-sm text-zinc-500">Loading…</p> : <PriceChart points={chartPoints} height={280} />}
        </div>
      </div>
    </main>
  );
}
