'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PriceChart from '@/components/PriceChart';

interface PricePoint { date: string; usd: number | null; usdFoil: number | null; }
interface CardInfo { scryfallId: string; name: string; setCode: string; setName: string; imageUrl: string | null; priceUsd: number | null; priceFoilUsd: number | null; rarity: string | null; scryfallUri: string; }

const WINDOWS = [7, 30, 90];

export default function CardDetailPage() {
  const params = useParams<{ scryfallId: string }>();
  const scryfallId = params.scryfallId;
  const [days, setDays] = useState(90);
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [card, setCard] = useState<CardInfo | null>(null);
  const [watched, setWatched] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [histRes, cardRes, watchRes] = await Promise.all([
      fetch(`/api/market/card/${scryfallId}/history?days=${days}`).then(r => r.json()),
      fetch(`/api/market/card/${scryfallId}`).then(r => r.json()),
      fetch('/api/market/watchlist').then(r => r.json()),
    ]);
    setPoints(histRes.points ?? []);
    setCard(cardRes.card ?? null);
    const item = watchRes.items?.find((w: any) => w.kind === 'card' && w.scryfallId === scryfallId);
    setWatched(!!item);
    setWatchId(item?.id ?? null);
  }, [scryfallId, days]);

  useEffect(() => { load(); }, [load]);

  async function toggleWatch() {
    if (watched && watchId) {
      await fetch(`/api/market/watchlist/${watchId}`, { method: 'DELETE' });
      setWatched(false);
      setWatchId(null);
    } else if (card) {
      await fetch('/api/market/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'card', scryfallId: card.scryfallId, cardName: card.name }),
      });
      load();
    }
  }

  const chartPoints = (points ?? []).map(p => ({ date: p.date, value: p.usd }));
  const first = chartPoints.find(p => p.value !== null)?.value ?? null;
  const last = [...chartPoints].reverse().find(p => p.value !== null)?.value ?? null;
  const changePct = first && last ? ((last - first) / first) * 100 : null;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-zinc-100">
      <Link href="/market" className="text-xs text-zinc-500 hover:text-zinc-300">← Back to Market</Link>

      <div className="flex items-start gap-6 mt-3 mb-6">
        {card?.imageUrl && (
          <img src={card.imageUrl} alt={card.name} className="w-40 rounded-xl border border-zinc-800 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">{card?.name ?? 'Loading…'}</h1>
              {card && <p className="text-sm text-zinc-500">{card.setName} ({card.setCode.toUpperCase()}) · {card.rarity}</p>}
            </div>
            {card && (
              <button type="button" onClick={toggleWatch}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${watched ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-300 border border-zinc-700'}`}>
                {watched ? '★ Watching' : '☆ Watch'}
              </button>
            )}
          </div>

          {card && (
            <div className="flex gap-6 mt-4 text-sm">
              <div>
                <p className="text-zinc-500 text-xs">Current (nonfoil)</p>
                <p className="font-semibold">{card.priceUsd !== null ? `$${card.priceUsd.toFixed(2)}` : '—'}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Current (foil)</p>
                <p className="font-semibold">{card.priceFoilUsd !== null ? `$${card.priceFoilUsd.toFixed(2)}` : '—'}</p>
              </div>
              <a href={card.scryfallUri} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300 text-xs self-end">
                View on Scryfall →
              </a>
            </div>
          )}
        </div>
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
          {changePct !== null && (
            <p className={`text-xs font-semibold ${changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}% over {days}d
            </p>
          )}
        </div>
        {points === null ? <p className="text-sm text-zinc-500">Loading…</p> : <PriceChart points={chartPoints} height={220} />}
      </div>
    </main>
  );
}
