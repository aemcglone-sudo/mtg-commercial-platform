'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PriceChart from '@/components/PriceChart';

interface SetIndexPoint { date: string; avgUsd: number | null; cardCount: number; }

const WINDOWS = [7, 30, 90];

export default function SetDetailPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const [days, setDays] = useState(90);
  const [points, setPoints] = useState<SetIndexPoint[] | null>(null);
  const [watched, setWatched] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [setName, setSetName] = useState<string>(code.toUpperCase());

  const load = useCallback(async () => {
    const [histRes, setsRes, watchRes] = await Promise.all([
      fetch(`/api/market/sets/${code}/history?days=${days}`).then(r => r.json()),
      fetch('/api/market/sets').then(r => r.json()),
      fetch('/api/market/watchlist').then(r => r.json()),
    ]);
    setPoints(histRes.points ?? []);
    const meta = setsRes.sets?.find((s: any) => s.code === code);
    if (meta) setSetName(meta.name);
    const item = watchRes.items?.find((w: any) => w.kind === 'set' && w.setCode === code);
    setWatched(!!item);
    setWatchId(item?.id ?? null);
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
        body: JSON.stringify({ kind: 'set', setCode: code, setName }),
      });
      load();
    }
  }

  const chartPoints = (points ?? []).map(p => ({ date: p.date, value: p.avgUsd }));
  const first = chartPoints.find(p => p.value !== null)?.value ?? null;
  const last = [...chartPoints].reverse().find(p => p.value !== null)?.value ?? null;
  const changePct = first && last ? ((last - first) / first) * 100 : null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-zinc-100">
      <Link href="/market" className="text-xs text-zinc-500 hover:text-zinc-300">← Back to Market</Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{setName}</h1>
          <p className="text-sm text-zinc-500">{code.toUpperCase()} · Set price index (average card price)</p>
        </div>
        <button type="button" onClick={toggleWatch}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${watched ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-300 border border-zinc-700'}`}>
          {watched ? '★ Watching' : '☆ Watch'}
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
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
        {points === null ? <p className="text-sm text-zinc-500">Loading…</p> : <PriceChart points={chartPoints} height={220} />}
      </div>
    </main>
  );
}
