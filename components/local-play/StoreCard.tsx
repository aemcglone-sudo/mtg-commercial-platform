'use client';

import Link from 'next/link';

export interface StoreData {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: string;
  lng: string;
  phone: string | null;
  website_url: string | null;
  hours_raw: string | null;
  is_partner: boolean;
  grimoire_shop_id: string | null;
  inventory_count: number;
  upcoming_events_count: number;
  distance_miles: number;
}

interface Props {
  store: StoreData;
}

export default function StoreCard({ store }: Props) {
  const addressLine = [store.address, store.city, store.state].filter(Boolean).join(', ');

  return (
    <div className={`bg-zinc-900 border rounded-xl p-4 ${store.is_partner ? 'border-amber-500/30' : 'border-zinc-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-zinc-100 text-sm">{store.name}</h3>
            {store.is_partner && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-wide">
                Grimoire Partner
              </span>
            )}
          </div>

          {addressLine && (
            <p className="text-xs text-zinc-400 mb-2">{addressLine}</p>
          )}

          {store.hours_raw && (
            <p className="text-xs text-zinc-500 mb-2 truncate">{store.hours_raw}</p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            {store.upcoming_events_count > 0 && (
              <span className="text-green-400">
                {store.upcoming_events_count} upcoming event{store.upcoming_events_count !== 1 ? 's' : ''}
              </span>
            )}
            {store.is_partner && store.inventory_count > 0 && (
              <span>{store.inventory_count.toLocaleString()} cards in inventory</span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-zinc-400">{store.distance_miles.toFixed(1)} mi</p>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <Link
          href={`/local-play/stores/${store.id}`}
          className="flex-1 text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
        >
          {store.is_partner ? 'View Store' : 'View Details'}
        </Link>
        {store.is_partner && (
          <Link
            href={`/marketplace/find?shopId=${store.grimoire_shop_id}`}
            className="flex-1 text-center bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium py-2 px-3 rounded-lg transition-colors border border-amber-500/20"
          >
            Find Cards Here
          </Link>
        )}
        {!store.is_partner && (
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 py-2 px-3 rounded-lg transition-colors"
            onClick={() => {
              window.location.href = `/local-play/stores/${store.id}#claim`;
            }}
          >
            Claim →
          </button>
        )}
      </div>
    </div>
  );
}
