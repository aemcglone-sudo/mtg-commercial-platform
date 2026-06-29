'use client';

import { useState, useEffect } from 'react';

interface Prefs {
  lat: number | null;
  lng: number | null;
  address: string;
  searchRadiusMiles: number;
  notifyOnAvailability: boolean;
  notifyOnCampaigns: boolean;
  smsEnabled: boolean;
  smsNumber: string;
  mutedShops: string[];
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return null;
  const data = await res.json() as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export default function CollectorMarketplacePrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((data: Prefs | null) => setPrefs(data ?? {
        lat: null, lng: null, address: '', searchRadiusMiles: 50,
        notifyOnAvailability: true, notifyOnCampaigns: true,
        smsEnabled: false, smsNumber: '', mutedShops: [],
      }))
      .catch(() => {});
  }, []);

  function requestGPS() {
    navigator.geolocation.getCurrentPosition(
      pos => setPrefs(p => p ? { ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, address: '' } : p),
      () => setError('Could not get your location')
    );
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError('');

    let { lat, lng } = prefs;

    if (prefs.address && (!lat || !lng)) {
      const coords = await geocodeAddress(prefs.address);
      if (!coords) {
        setError('Could not find that address. Try including city and state.');
        setSaving(false);
        return;
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    const res = await fetch('/api/marketplace/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prefs, lat, lng }),
    });
    if (!res.ok) {
      setError('Failed to save');
    } else {
      setPrefs(p => p ? { ...p, lat, lng } : p);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (!prefs) return <div className="text-zinc-600 text-sm py-8">Loading…</div>;

  return (
    <div className="space-y-8">
      {/* Location */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100">Your Location</h2>
        <p className="text-xs text-zinc-500">Used to calculate distance to nearby shops. Your address is geocoded to coordinates and never shared with stores.</p>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Home address</label>
          <input
            type="text"
            value={prefs.address ?? ''}
            onChange={e => setPrefs({ ...prefs, address: e.target.value, lat: null, lng: null })}
            placeholder="123 Main St, Atlanta, GA 30301"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          {prefs.lat && prefs.lng && (
            <p className="text-xs text-emerald-500 mt-1">📍 Location resolved ({prefs.lat.toFixed(4)}, {prefs.lng.toFixed(4)})</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">or</span>
          <button type="button" onClick={requestGPS} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors border border-zinc-700">
            📡 Use my current location
          </button>
          {prefs.lat && prefs.lng && !prefs.address && (
            <span className="text-xs text-emerald-500">📍 GPS set</span>
          )}
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Search radius</label>
          <select
            value={prefs.searchRadiusMiles}
            onChange={e => setPrefs({ ...prefs, searchRadiusMiles: parseInt(e.target.value) })}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none"
          >
            {[10, 25, 50, 100].map(r => <option key={r} value={r}>{r} miles</option>)}
          </select>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100">Notifications</h2>

        {[
          { key: 'notifyOnAvailability' as const, label: 'Notify me when watchlisted cards become available' },
          { key: 'notifyOnCampaigns' as const, label: 'Receive shop campaigns and promotions' },
          { key: 'smsEnabled' as const, label: 'Enable SMS notifications' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setPrefs({ ...prefs, [key]: !prefs[key] })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${prefs[key] ? 'bg-emerald-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs[key] ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-zinc-300">{label}</span>
          </label>
        ))}

        {prefs.smsEnabled && (
          <div>
            <label className="block text-sm text-zinc-400 mb-1">SMS number</label>
            <input
              type="tel"
              value={prefs.smsNumber}
              onChange={e => setPrefs({ ...prefs, smsNumber: e.target.value })}
              placeholder="+15551234567"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
      >
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Preferences'}
      </button>
    </div>
  );
}
