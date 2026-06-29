'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Store {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  website: string;
  specialties: string[];
  hours: string;
  distanceMiles: number;
  inventoryCount: number;
  featuredUntil: string | null;
}

export default function StoreDiscovery() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [zip, setZip] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [radius, setRadius] = useState(50);

  useEffect(() => {
    fetch('/api/marketplace/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((prefs: { lat: number | null; lng: number | null } | null) => {
        if (prefs?.lat && prefs?.lng) {
          setLocation({ lat: prefs.lat, lng: prefs.lng });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (location) fetchStores();
  }, [location, specialty, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchStores() {
    if (!location) return;
    setLoading(true);
    const params = new URLSearchParams({
      lat: String(location.lat), lng: String(location.lng), radius: String(radius),
    });
    if (specialty) params.set('specialty', specialty);
    const res = await fetch(`/api/marketplace/stores?${params}`);
    if (res.ok) {
      const data = await res.json() as { stores: Store[] };
      setStores(data.stores);
    }
    setLoading(false);
  }

  async function setByZip() {
    if (!/^\d{5}$/.test(zip)) return;
    const res = await fetch(`/api/marketplace/geocode?zip=${zip}`);
    if (res.ok) {
      const data = await res.json() as { lat: number; lng: number };
      setLocation(data);
    }
  }

  function requestGPS() {
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }

  if (!location) {
    return (
      <div className="text-center space-y-4 py-12">
        <p className="text-zinc-500 text-sm">Share your location to find nearby stores.</p>
        <button type="button" onClick={requestGPS} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-colors">Use my location</button>
        <div className="flex gap-2 max-w-xs mx-auto">
          <input type="text" value={zip} onChange={e => setZip(e.target.value)} onKeyDown={e => e.key === 'Enter' && setByZip()} placeholder="Or enter zip code" maxLength={5} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none" />
          <button type="button" onClick={setByZip} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm transition-colors">Go</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        <select value={radius} onChange={e => setRadius(parseInt(e.target.value))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none">
          <option value={10}>10 mi</option>
          <option value={25}>25 mi</option>
          <option value={50}>50 mi</option>
          <option value={100}>100 mi</option>
        </select>
        <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Filter by specialty…" className="flex-1 min-w-[140px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none" />
        <button type="button" onClick={() => setLocation(null)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Change location</button>
      </div>

      {loading ? (
        <p className="text-zinc-600 text-sm text-center py-12">Finding stores…</p>
      ) : stores.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-12">No stores found within {radius} miles.</p>
      ) : (
        <div className="space-y-4">
          {stores.map(s => (
            <Link key={s.id} href={`/stores/${s.slug}`} className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-colors space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-zinc-100">{s.name}</h2>
                    {s.featuredUntil && new Date(s.featuredUntil) > new Date() && (
                      <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">FEATURED</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{s.address}</p>
                </div>
                <div className="text-right shrink-0">
                  {s.distanceMiles && <p className="text-xs text-zinc-500">{s.distanceMiles} mi</p>}
                  <p className="text-xs text-zinc-600">{s.inventoryCount.toLocaleString()} cards</p>
                </div>
              </div>

              {s.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {s.specialties.map(sp => (
                    <span key={sp} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{sp}</span>
                  ))}
                </div>
              )}

              {s.hours && <p className="text-xs text-zinc-600">⏰ {s.hours}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
