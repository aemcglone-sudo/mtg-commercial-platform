'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import StoreClaimModal from '@/components/local-play/StoreClaimModal';
import EventCard, { type EventData } from '@/components/local-play/EventCard';

interface StoreDetail {
  id: string; name: string; slug: string; address: string | null; city: string | null;
  state: string | null; zip: string | null; lat: string; lng: string; phone: string | null;
  website_url: string | null; hours_raw: string | null; hours: Record<string, string> | null;
  is_active: boolean; grimoire_shop_id: string | null; sync_source: string | null;
  is_partner: boolean; inventory_count: number;
}

export default function StoreDetailPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = use(params);
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClaim, setShowClaim] = useState(false);

  useEffect(() => {
    fetch(`/api/local-play/stores/${storeId}`)
      .then(r => r.json())
      .then((data: { store?: StoreDetail; events?: EventData[] }) => {
        setStore(data.store ?? null);
        setEvents(data.events ?? []);
      })
      .finally(() => setLoading(false));

    // Check URL hash for claim modal
    if (window.location.hash === '#claim') setShowClaim(true);
  }, [storeId]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-64 text-zinc-500 text-sm">Loading…</div>;
  }
  if (!store) {
    return <div className="px-4 py-8 text-zinc-400">Store not found.</div>;
  }

  const addressLine = [store.address, store.city, store.state, store.zip].filter(Boolean).join(', ');
  const mapQuery = encodeURIComponent(addressLine || store.name);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/local-play" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 mb-6">
        ← Back to Local Play
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-zinc-100">{store.name}</h1>
            {store.is_partner && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-wide">
                Grimoire Partner
              </span>
            )}
          </div>
          {addressLine && <p className="text-sm text-zinc-400">{addressLine}</p>}
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4 space-y-2">
        {store.phone && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">📞</span>
            <a href={`tel:${store.phone}`} className="text-zinc-300 hover:text-amber-400 transition-colors">
              {store.phone}
            </a>
          </div>
        )}
        {store.website_url && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">🌐</span>
            <a href={store.website_url} target="_blank" rel="noopener noreferrer"
              className="text-zinc-300 hover:text-amber-400 transition-colors truncate">
              {store.website_url.replace(/^https?:\/\/(www\.)?/, '')}
            </a>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">📍</span>
          <a
            href={`https://maps.google.com/maps?q=${mapQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-300 hover:text-amber-400 transition-colors"
          >
            Get directions
          </a>
        </div>
        {store.hours_raw && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-zinc-500 mt-0.5">🕐</span>
            <span className="text-zinc-400 text-xs">{store.hours_raw}</span>
          </div>
        )}
      </div>

      {/* Partner actions */}
      {store.is_partner && (
        <div className="flex gap-3 mb-6">
          {store.inventory_count > 0 && (
            <Link
              href={`/marketplace/find?shopId=${store.grimoire_shop_id}`}
              className="flex-1 text-center bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Browse {store.inventory_count.toLocaleString()} Cards
            </Link>
          )}
        </div>
      )}

      {/* Upcoming events */}
      {events.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-zinc-200 mb-3">Upcoming Events</h2>
          <div className="space-y-2">
            {events.map(event => (
              <EventCard key={event.id} event={event} showStore={false} />
            ))}
          </div>
        </div>
      )}

      {/* Claim CTA for discovered stores */}
      {!store.is_partner && (
        <div id="claim" className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="font-semibold text-zinc-200 text-sm mb-1">Is this your store?</h3>
          <p className="text-xs text-zinc-500 mb-3">
            Claim this listing to get a full Grimoire partner profile, inventory management, and events calendar.
          </p>
          <button
            type="button"
            onClick={() => setShowClaim(true)}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Claim This Store
          </button>
        </div>
      )}

      {showClaim && store && (
        <StoreClaimModal
          storeId={store.id}
          storeName={store.name}
          onClose={() => setShowClaim(false)}
        />
      )}
    </div>
  );
}
