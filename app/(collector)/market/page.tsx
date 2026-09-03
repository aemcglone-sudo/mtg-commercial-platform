'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface CardSearchOption { name: string; scryfallId: string; imageUrl: string | null; typeLine: string | null; }

interface SetMover { setCode: string; avgUsdNow: number; avgUsdBefore: number; changePercent: number; cardCount: number; }
interface CardMover { scryfallId: string; cardName: string; setCode: string; usdNow: number; usdBefore: number; changePercent: number; }
interface WatchlistItem { id: string; kind: 'card' | 'set'; scryfallId: string | null; cardName: string | null; setCode: string | null; setName: string | null; createdAt: string; }

const WINDOWS = [7, 30, 90];

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function ChangeBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function MarketPage() {
  const [tab, setTab] = useState<'movers' | 'watchlist'>('movers');
  const [days, setDays] = useState(7);
  const [setMovers, setSetMovers] = useState<{ gainers: SetMover[]; losers: SetMover[] } | null>(null);
  const [cardMovers, setCardMovers] = useState<{ gainers: CardMover[]; losers: CardMover[] } | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);

  const loadMovers = useCallback(async () => {
    setLoading(true);
    const [setRes, cardRes] = await Promise.all([
      fetch(`/api/market/movers?type=set&days=${days}`).then(r => r.json()),
      fetch(`/api/market/movers?type=card&days=${days}`).then(r => r.json()),
    ]);
    setSetMovers(setRes);
    setCardMovers(cardRes);
    setNoData((setRes.gainers?.length ?? 0) === 0 && (setRes.losers?.length ?? 0) === 0 && (cardRes.gainers?.length ?? 0) === 0 && (cardRes.losers?.length ?? 0) === 0);
    setLoading(false);
  }, [days]);

  const loadWatchlist = useCallback(async () => {
    const res = await fetch('/api/market/watchlist').then(r => r.json());
    setWatchlist(res.items ?? []);
  }, []);

  useEffect(() => { loadMovers(); }, [loadMovers]);
  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  async function removeWatch(id: string) {
    setWatchlist(prev => prev?.filter(w => w.id !== id) ?? null);
    await fetch(`/api/market/watchlist/${id}`, { method: 'DELETE' });
  }

  async function addSetWatch(setCode: string, setName: string) {
    await fetch('/api/market/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'set', setCode, setName }),
    });
    loadWatchlist();
  }

  async function addCardWatch(scryfallId: string, cardName: string) {
    await fetch('/api/market/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'card', scryfallId, cardName }),
    });
    loadWatchlist();
  }

  const isSetWatched = (code: string) => watchlist?.some(w => w.kind === 'set' && w.setCode === code) ?? false;
  const isCardWatched = (id: string) => watchlist?.some(w => w.kind === 'card' && w.scryfallId === id) ?? false;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Market</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Speculate on card and set price movements — like a stock market for Magic.</p>
        </div>
        <Link href="/market/sets" className="text-xs text-amber-400 hover:text-amber-300">Browse all sets →</Link>
      </div>

      <CardSearchBox onWatch={addCardWatch} isWatched={isCardWatched} />

      <div className="flex items-center gap-2 mb-6">
        <button type="button" onClick={() => setTab('movers')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'movers' ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
          Movers
        </button>
        <button type="button" onClick={() => setTab('watchlist')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'watchlist' ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
          Watchlist {watchlist && watchlist.length > 0 ? `(${watchlist.length})` : ''}
        </button>
        {tab === 'movers' && (
          <div className="ml-auto flex items-center gap-1">
            {WINDOWS.map(w => (
              <button key={w} type="button" onClick={() => setDays(w)}
                className={`px-2.5 py-1 rounded text-xs ${days === w ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {w}d
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'movers' && (
        <div className="space-y-8">
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}

          {!loading && noData && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
              No price history yet. The market needs at least two daily snapshots before it can show movers —
              check back tomorrow, or ask your admin to run the price sync.
            </div>
          )}

          {!loading && !noData && (
            <>
              <section>
                <h2 className="text-sm font-semibold text-zinc-300 mb-3">Set Movers ({days}d)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MoversTable
                    title="Gainers" rows={setMovers?.gainers ?? []} kind="set"
                    isWatched={r => isSetWatched(r.setCode)}
                    onWatch={r => addSetWatch(r.setCode, r.setCode)}
                  />
                  <MoversTable
                    title="Losers" rows={setMovers?.losers ?? []} kind="set"
                    isWatched={r => isSetWatched(r.setCode)}
                    onWatch={r => addSetWatch(r.setCode, r.setCode)}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-zinc-300 mb-3">Card Movers ({days}d)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MoversTable
                    title="Gainers" rows={cardMovers?.gainers ?? []} kind="card"
                    isWatched={r => isCardWatched(r.scryfallId)}
                    onWatch={r => addCardWatch(r.scryfallId, r.cardName)}
                  />
                  <MoversTable
                    title="Losers" rows={cardMovers?.losers ?? []} kind="card"
                    isWatched={r => isCardWatched(r.scryfallId)}
                    onWatch={r => addCardWatch(r.scryfallId, r.cardName)}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {tab === 'watchlist' && (
        <div className="space-y-2">
          {watchlist === null && <p className="text-sm text-zinc-500">Loading…</p>}
          {watchlist !== null && watchlist.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
              Nothing watched yet. Star a card or set from the Movers tab to track it here.
            </div>
          )}
          {watchlist?.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
              <Link
                href={item.kind === 'card' ? `/market/card/${item.scryfallId}` : `/market/sets/${item.setCode}`}
                className="text-sm font-medium hover:text-amber-400 transition-colors"
              >
                {item.kind === 'card' ? item.cardName : item.setName}
                <span className="text-zinc-600 text-xs ml-2 uppercase">{item.kind}</span>
              </Link>
              <button type="button" onClick={() => removeWatch(item.id)} className="text-xs text-zinc-500 hover:text-red-400">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function MoversTable<T extends { changePercent: number }>({
  title, rows, kind, isWatched, onWatch,
}: {
  title: string;
  rows: T[];
  kind: 'set' | 'card';
  isWatched: (r: T) => boolean;
  onWatch: (r: T) => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{title}</p>
      {rows.length === 0 && <p className="text-xs text-zinc-600">No data.</p>}
      <div className="space-y-1.5">
        {rows.map((r: any, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm">
            <Link
              href={kind === 'set' ? `/market/sets/${r.setCode}` : `/market/card/${r.scryfallId}`}
              className="truncate hover:text-amber-400 transition-colors flex-1"
            >
              {kind === 'set' ? r.setCode.toUpperCase() : r.cardName}
            </Link>
            <span className="text-zinc-500 text-xs shrink-0">{fmtUsd(kind === 'set' ? r.avgUsdNow : r.usdNow)}</span>
            <span className="shrink-0"><ChangeBadge pct={r.changePercent} /></span>
            <button type="button" onClick={() => onWatch(r)} disabled={isWatched(r)}
              className={`shrink-0 text-xs ${isWatched(r) ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-400'}`}
              title={isWatched(r) ? 'Watching' : 'Add to watchlist'}>
              {isWatched(r) ? '★' : '☆'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSearchBox({ onWatch, isWatched }: { onWatch: (scryfallId: string, name: string) => void; isWatched: (id: string) => boolean }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CardSearchOption[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/simulator/card-search?q=${encodeURIComponent(value)}`).then(r => r.json());
      setResults(res.results ?? []);
      setOpen(true);
    }, 300);
  }

  return (
    <div className="relative mb-6">
      <input
        type="text" placeholder="Search for a card to watch…" value={q}
        onChange={e => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
          {results.map(r => (
            <div key={r.scryfallId} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-800 text-sm">
              <Link href={`/market/card/${r.scryfallId}`} className="truncate flex-1">{r.name}</Link>
              <button type="button" onClick={() => onWatch(r.scryfallId, r.name)} disabled={isWatched(r.scryfallId)}
                className={`shrink-0 text-xs ml-2 ${isWatched(r.scryfallId) ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-400'}`}>
                {isWatched(r.scryfallId) ? '★' : '☆'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
