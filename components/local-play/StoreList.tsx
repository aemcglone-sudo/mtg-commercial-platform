'use client';

import { useEffect, useState } from 'react';
import StoreCard, { type StoreData } from './StoreCard';

interface Props {
  lat: number;
  lng: number;
  radius: number;
}

export default function StoreList({ lat, lng, radius }: Props) {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'partner' | 'events'>('all');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/local-play/stores?lat=${lat}&lng=${lng}&radius=${radius}`)
      .then(r => r.json())
      .then((data: { stores?: StoreData[]; error?: string }) => {
        if (data.error) setError(data.error);
        else setStores(data.stores ?? []);
      })
      .catch(() => setError('Failed to load stores'))
      .finally(() => setLoading(false));
  }, [lat, lng, radius]);

  const filtered = stores.filter(s => {
    if (filter === 'partner') return s.is_partner;
    if (filter === 'events') return s.upcoming_events_count > 0;
    return true;
  });

  const partnerCount = stores.filter(s => s.is_partner).length;
  const discoveredCount = stores.filter(s => !s.is_partner).length;

  return (
    <div className="px-4 space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: 'all' as const, label: 'All' },
          { id: 'partner' as const, label: 'Grimoire Partners' },
          { id: 'events' as const, label: 'Has Events' },
        ].map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-amber-500 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-zinc-500 text-sm py-8 text-center">Finding stores near you…</div>
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {!loading && !error && stores.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400 text-sm">No stores found within {radius} miles.</p>
          <p className="text-zinc-600 text-xs mt-1">Try increasing the radius in your location settings.</p>
        </div>
      )}

      {!loading && !error && stores.length > 0 && (
        <>
          <p className="text-xs text-zinc-500">
            {partnerCount > 0 && `${partnerCount} partner${partnerCount !== 1 ? 's' : ''}`}
            {partnerCount > 0 && discoveredCount > 0 && ' · '}
            {discoveredCount > 0 && `${discoveredCount} discovered`}
          </p>

          <div className="space-y-3">
            {filtered.map(store => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-zinc-500 text-sm text-center py-4">
              No stores match this filter.
            </div>
          )}
        </>
      )}
    </div>
  );
}
