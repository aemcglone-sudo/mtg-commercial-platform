'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/marketplace/MapView'), { ssr: false });

interface Store {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  websiteUrl: string;
  lat: number | null;
  lng: number | null;
  inventoryCount: number;
  distanceMiles: number | null;
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeShop, setActiveShop] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Load all shops immediately so the page isn't blank
    loadStores(null);

    // Then try to get location to show distance + map
    fetch('/api/marketplace/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((prefs: { lat: number | null; lng: number | null } | null) => {
        if (prefs?.lat && prefs?.lng) {
          setLocation({ lat: prefs.lat, lng: prefs.lng });
          loadStores({ lat: prefs.lat, lng: prefs.lng });
        } else {
          navigator.geolocation?.getCurrentPosition(
            pos => {
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              setLocation(loc);
              loadStores(loc);
            },
            () => {} // already loaded all shops above
          );
        }
      })
      .catch(() => {}); // already loaded
  }, []);

  async function loadStores(loc: { lat: number; lng: number } | null) {
    setLoading(true);
    const params = loc ? `?lat=${loc.lat}&lng=${loc.lng}&radius=50` : '';
    const res = await fetch(`/api/marketplace/stores${params}`);
    const d = await res.json() as { stores: Store[] };
    setStores(d.stores ?? []);
    setLoading(false);
  }

  const mappableShops = stores.filter(s => s.lat && s.lng);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold">Nearby Shops</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Local game stores on Grimoire{location ? ' within 50 miles' : ''}</p>
        </div>

        {/* Map */}
        {!loading && mappableShops.length > 0 && location && (
          <MapView
            activePinLabel={activeShop}
            pins={[
              { lat: location.lat, lng: location.lng, label: 'You', isUser: true },
              ...mappableShops.map(s => ({
                lat: s.lat!,
                lng: s.lng!,
                label: s.name,
                popup: `<strong>${s.name}</strong><br/>${s.address}`,
              })),
            ]}
            className="h-56 rounded-xl overflow-hidden"
          />
        )}

        {loading ? (
          <p className="text-zinc-600 text-sm py-8 text-center">Loading…</p>
        ) : stores.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-zinc-500 text-sm">No shops found{location ? ' within 50 miles' : ''}.</p>
            {location && (
              <button
                type="button"
                onClick={() => loadStores(null)}
                className="text-xs text-zinc-500 underline hover:text-zinc-300"
              >
                Show all shops
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {stores.map(s => (
              <Link
                key={s.id}
                href={`/stores/${s.slug}`}
                onMouseEnter={() => setActiveShop(s.name)}
                onMouseLeave={() => setActiveShop(undefined)}
                className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-5 py-4 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-100 group-hover:text-white leading-snug">{s.name}</p>
                    {s.address && <p className="text-sm text-zinc-500 mt-0.5">{s.address}</p>}
                    {s.websiteUrl && (
                      <p className="text-xs text-emerald-500 mt-1 truncate">{s.websiteUrl.replace(/^https?:\/\//, '')}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    {s.distanceMiles !== null && (
                      <p className="text-xs text-zinc-500">{s.distanceMiles} mi</p>
                    )}
                    <p className="text-xs text-zinc-600">{s.inventoryCount} singles</p>
                    <p className="text-xs text-zinc-700 group-hover:text-zinc-500">View →</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
