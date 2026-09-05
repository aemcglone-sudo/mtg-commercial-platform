'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PriceChart from '@/components/PriceChart';
import PredictionCard from '@/components/PredictionCard';

interface PricePoint { date: string; usd: number | null; usdFoil: number | null; }
interface CardInfo { scryfallId: string; name: string; setCode: string; setName: string; imageUrl: string | null; priceUsd: number | null; priceFoilUsd: number | null; rarity: string | null; scryfallUri: string; }
interface CardSignal {
  date: string; setCode: string; rarity: string | null; cmc: number | null;
  daysSinceRelease: number | null; releasePhase: string | null;
  momentum7d: number | null; momentum30d: number | null; momentum90d: number | null;
  volatility7d: number | null; volatility30d: number | null;
  priceVsSetMedian: number | null; currentPrice: number | null; price52wHigh: number | null; price52wLow: number | null;
}
interface DominantSignal { signal: string; value: string | number | null; }
interface CardPrediction {
  date: string; currentPrice: number | null;
  targetPrice6m: number | null; targetPrice6mLow: number | null; targetPrice6mHigh: number | null;
  confidencePct: number | null; predictionDirection: string | null; matchedPattern: string | null;
  dominantSignals: DominantSignal[];
  upsideScenario: string | null; upsideTarget: number | null;
  downsideScenario: string | null; downsideTarget: number | null;
  riskFactors: string[];
}
interface CardNews {
  hasNews: boolean; summary: string | null; category: string | null;
  sourceUrls: string[]; confidence: number | null; fetchedAt: string;
}
interface Printing { scryfallId: string; setCode: string; usd: number | null; usdFoil: number | null; priceDate: string; }
interface CardEvent {
  id: string; category: string; summary: string; sourceUrls: string[];
  confidence: number | null; priceAtDetection: number | null; detectedAt: string;
}

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  reprint: 'Reprint', banned: 'Ban/Unban', tournament: 'Tournament result', set_synergy: 'New set synergy', other: 'News',
};

const PHASE_LABELS: Record<string, string> = {
  presale: 'Presale', hype_spike: 'Hype Spike', supply_flood: 'Supply Flood',
  stabilization: 'Stabilizing', mature: 'Mature',
};

function pct(n: number | null): string {
  if (n === null) return '—';
  const v = n * 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}
function pctColor(n: number | null): string {
  if (n === null) return 'text-zinc-500';
  return n >= 0 ? 'text-emerald-400' : 'text-red-400';
}

const WINDOWS = [7, 30, 90];

export default function CardDetailPage() {
  const params = useParams<{ scryfallId: string }>();
  const router = useRouter();
  const scryfallId = params.scryfallId;
  const [days, setDays] = useState(90);
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [card, setCard] = useState<CardInfo | null>(null);
  const [signal, setSignal] = useState<CardSignal | null | undefined>(undefined);
  const [prediction, setPrediction] = useState<CardPrediction | null | undefined>(undefined);
  const [news, setNews] = useState<CardNews | null>(null);
  const [watched, setWatched] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [printings, setPrintings] = useState<Printing[] | null>(null);
  const [setNameByCode, setSetNameByCode] = useState<Map<string, string>>(new Map());
  const [events, setEvents] = useState<CardEvent[]>([]);

  const load = useCallback(async () => {
    const [histRes, cardRes, watchRes, signalRes, predictionRes, newsRes, printingsRes, setsRes, eventsRes] = await Promise.all([
      fetch(`/api/market/card/${scryfallId}/history?days=${days}`).then(r => r.json()),
      fetch(`/api/market/card/${scryfallId}`).then(r => r.json()),
      fetch('/api/market/watchlist').then(r => r.json()),
      fetch(`/api/market/card/${scryfallId}/signals`).then(r => r.json()),
      fetch(`/api/market/card/${scryfallId}/prediction`).then(r => r.json()),
      fetch(`/api/market/card/${scryfallId}/news`).then(r => r.json()),
      fetch(`/api/market/card/${scryfallId}/printings`).then(r => r.json()),
      fetch('/api/market/sets?all=1').then(r => r.json()),
      fetch(`/api/market/card/${scryfallId}/events`).then(r => r.json()),
    ]);
    setPoints(histRes.points ?? []);
    setCard(cardRes.card ?? null);
    setSignal(signalRes.signal ?? null);
    setPrediction(predictionRes.prediction ?? null);
    setNews(newsRes.news ?? null);
    setPrintings(printingsRes.printings ?? []);
    setSetNameByCode(new Map((setsRes.sets ?? []).map((s: any) => [s.code, s.name])));
    setEvents(eventsRes.events ?? []);
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
        body: JSON.stringify({ kind: 'card', scryfallId: card.scryfallId, cardName: card.name, setCode: card.setCode, setName: card.setName }),
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

      {printings && printings.length > 1 && (
        <div className="mb-6 flex items-center gap-2">
          <label htmlFor="printing-select" className="text-xs uppercase tracking-wide text-zinc-500 shrink-0">
            {printings.length} tracked printings
          </label>
          <select
            id="printing-select"
            value={scryfallId}
            onChange={e => router.push(`/market/card/${e.target.value}`)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 max-w-xs"
          >
            {printings.map(p => (
              <option key={p.scryfallId} value={p.scryfallId}>
                {setNameByCode.get(p.setCode) ?? p.setCode.toUpperCase()} · {p.usd !== null ? `$${p.usd.toFixed(2)}` : '—'}
              </option>
            ))}
          </select>
        </div>
      )}

      {prediction && (
        <div className="mb-6">
          <PredictionCard prediction={prediction} news={news} />
        </div>
      )}
      {prediction === null && (
        <p className="text-xs text-zinc-600 mb-6">No prediction yet for this printing — it'll appear after the next daily run.</p>
      )}

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

      {signal && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mt-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">Signals — {new Date(signal.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 text-xs">7d momentum</p>
              <p className={`font-semibold ${pctColor(signal.momentum7d)}`}>{pct(signal.momentum7d)}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">30d momentum</p>
              <p className={`font-semibold ${pctColor(signal.momentum30d)}`}>{pct(signal.momentum30d)}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">90d momentum</p>
              <p className={`font-semibold ${pctColor(signal.momentum90d)}`}>{pct(signal.momentum90d)}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Release phase</p>
              <p className="font-semibold text-zinc-200">{signal.releasePhase ? PHASE_LABELS[signal.releasePhase] ?? signal.releasePhase : '—'}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">52w high</p>
              <p className="font-semibold text-zinc-200">{signal.price52wHigh !== null ? `$${signal.price52wHigh.toFixed(2)}` : '—'}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">52w low</p>
              <p className="font-semibold text-zinc-200">{signal.price52wLow !== null ? `$${signal.price52wLow.toFixed(2)}` : '—'}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">vs. set median</p>
              <p className="font-semibold text-zinc-200">{signal.priceVsSetMedian !== null ? `${signal.priceVsSetMedian.toFixed(1)}×` : '—'}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Days since release</p>
              <p className="font-semibold text-zinc-200">{signal.daysSinceRelease ?? '—'}</p>
            </div>
          </div>
        </div>
      )}
      {signal === null && (
        <p className="text-xs text-zinc-600 mt-4">No signal data yet for this printing.</p>
      )}

      {events.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mt-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
            Event History — detected reasons behind past price moves
          </p>
          <div className="space-y-3">
            {events.map(e => (
              <div key={e.id} className="border-l-2 border-sky-800 pl-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-0.5">
                  <span className="text-sky-400 font-medium">{EVENT_CATEGORY_LABELS[e.category] ?? e.category}</span>
                  <span>·</span>
                  <span>{new Date(e.detectedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  {e.priceAtDetection !== null && <><span>·</span><span>${e.priceAtDetection.toFixed(2)} at the time</span></>}
                </div>
                <p className="text-sm text-zinc-200">{e.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
