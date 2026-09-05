'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';

interface SetMeta { code: string; name: string; setType: string; releasedAt: string | null; cardCount: number; iconSvgUri: string | null; }
interface WatchlistItem { id: string; kind: 'card' | 'set'; setCode: string | null; }

export default function BrowseSetsPage() {
  const [sets, setSets] = useState<SetMeta[] | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const [setsRes, watchRes] = await Promise.all([
      fetch('/api/market/sets').then(r => r.json()),
      fetch('/api/market/watchlist').then(r => r.json()),
    ]);
    setSets(setsRes.sets ?? []);
    setWatchlist(watchRes.items ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleWatch(s: SetMeta) {
    const existing = watchlist?.find(w => w.kind === 'set' && w.setCode === s.code);
    if (existing) {
      setWatchlist(prev => prev?.filter(w => w.id !== existing.id) ?? null);
      await fetch(`/api/market/watchlist/${existing.id}`, { method: 'DELETE' });
    } else {
      await fetch('/api/market/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'set', setCode: s.code, setName: s.name }),
      });
      load();
    }
  }

  const filtered = (sets ?? []).filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-zinc-100">
      <BackButton fallbackHref="/market" />
      <h1 className="text-2xl font-bold mt-3 mb-1">All Sets</h1>
      <p className="text-sm text-zinc-500 mb-6">Watch a set to track its price index over time.</p>

      <input
        type="text" placeholder="Search sets…" value={q} onChange={e => setQ(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-amber-500"
      />

      {sets === null && <p className="text-sm text-zinc-500">Loading…</p>}

      <div className="space-y-1">
        {filtered.map(s => {
          const isWatched = watchlist?.some(w => w.kind === 'set' && w.setCode === s.code) ?? false;
          return (
            <div key={s.code} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5">
              <Link href={`/market/sets/${s.code}`} className="flex items-center gap-3 min-w-0 hover:text-amber-400 transition-colors">
                {s.iconSvgUri && <img src={s.iconSvgUri} alt="" className="w-4 h-4 invert opacity-70 shrink-0" />}
                <span className="text-sm truncate">{s.name}</span>
                <span className="text-xs text-zinc-600 shrink-0">{s.code.toUpperCase()}</span>
              </Link>
              <button type="button" onClick={() => toggleWatch(s)}
                className={`shrink-0 text-sm ml-3 ${isWatched ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-400'}`}>
                {isWatched ? '★' : '☆'}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
