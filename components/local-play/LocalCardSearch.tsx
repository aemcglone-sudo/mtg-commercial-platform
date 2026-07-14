'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface CardResult {
  card_name: string;
  scryfall_id: string;
  condition: string | null;
  price_cents: number | null;
  quantity: number;
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  shop_city: string | null;
  shop_slug: string;
  distance_miles: number;
}

interface Props {
  lat: number;
  lng: number;
  radius: number;
}

export default function LocalCardSearch({ lat, lng, radius }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 3) { setResults([]); setSearched(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/local-play/cards?q=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}&radius=${radius}`)
        .then(r => r.json())
        .then((data: { results?: CardResult[] }) => {
          setResults(data.results ?? []);
          setSearched(true);
        })
        .catch(() => { setResults([]); setSearched(true); })
        .finally(() => setLoading(false));
    }, 300);
  }, [query, lat, lng, radius]);

  // Group results by card name
  const grouped = results.reduce<Record<string, CardResult[]>>((acc, r) => {
    const key = r.card_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="px-4 space-y-4">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by card name…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 text-sm"
          autoFocus
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin">⟳</span>
        )}
      </div>

      {!query && (
        <div className="text-center py-8">
          <p className="text-zinc-400 text-sm">Search for any Magic card to see which nearby shops have it.</p>
          <p className="text-zinc-600 text-xs mt-2">Only shows cards at Grimoire partner shops within {radius} miles.</p>
        </div>
      )}

      {searched && !loading && results.length === 0 && query && (
        <div className="text-center py-8">
          <p className="text-zinc-400 text-sm">No local shops have "{query}" in stock right now.</p>
          <Link href="/marketplace/find" className="text-amber-400 hover:text-amber-300 text-xs mt-2 inline-block">
            Try the full Card Finder →
          </Link>
        </div>
      )}

      {Object.entries(grouped).map(([cardName, entries]) => (
        <div key={cardName} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
            <h3 className="font-semibold text-zinc-100 text-sm">{cardName}</h3>
            <p className="text-xs text-zinc-500">Available at {entries.length} location{entries.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-zinc-800">
            {entries.map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-200 font-medium">{r.shop_name}</p>
                  <p className="text-xs text-zinc-500">
                    {r.distance_miles.toFixed(1)} mi
                    {r.condition && ` · ${r.condition}`}
                    {` · ${r.quantity} in stock`}
                  </p>
                </div>
                <div className="text-right">
                  {r.price_cents != null && (
                    <p className="text-sm font-medium text-zinc-200">${(r.price_cents / 100).toFixed(2)}</p>
                  )}
                  <Link
                    href={`/marketplace/find?shopId=${r.shop_id}&q=${encodeURIComponent(cardName)}`}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
