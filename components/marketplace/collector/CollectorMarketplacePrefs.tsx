'use client';

import { useState, useEffect } from 'react';

interface Prefs {
  lat: number | null;
  lng: number | null;
  searchRadiusMiles: number;
  notifyOnAvailability: boolean;
  notifyOnCampaigns: boolean;
  smsEnabled: boolean;
  smsNumber: string;
  mutedShops: string[];
}

export default function CollectorMarketplacePrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [zip, setZip] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/marketplace/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((data: Prefs | null) => setPrefs(data ?? {
        lat: null, lng: null, searchRadiusMiles: 50,
        notifyOnAvailability: true, notifyOnCampaigns: true,
        smsEnabled: false, smsNumber: '', mutedShops: [],
      }))
      .catch(() => {});
  }, []);

  async function geoByZip() {
    if (!/^\d{5}$/.test(zip)) { setError('Enter a valid 5-digit zip'); return; }
    const res = await fetch(`/api/marketplace/geocode?zip=${zip}`);
    if (!res.ok) { setError('Zip not found'); return; }
    const data = await res.json() as { lat: number; lng: number };
    setPrefs(p => p ? { ...p, lat: data.lat, lng: data.lng } : p);
    setError('');
  }

  function requestGPS() {
    navigator.geolocation.getCurrentPosition(
      pos => setPrefs(p => p ? { ...p, lat: pos.coords.latitude, lng: pos.coords.longitude } : p),
      () => setError('Could not get your location')
    );
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError('');
    const res = await fetch('/api/marketplace/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) { setError('Failed to save'); }
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  }

  if (!prefs) return <div className="text-zinc-600 text-sm py-8">Loading…</div>;

  return (
    <div className="space-y-8">
      {/* Location */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100">Location</h2>
        {prefs.lat && prefs.lng ? (
          <p className="text-sm text-emerald-400">📍 Location set ({prefs.lat.toFixed(3)}, {prefs.lng.toFixed(3)})</p>
        ) : (
          <p className="text-sm text-zinc-500">No location set — results won't show distance</p>
        )}
        <div className="flex gap-2">
          <input type="text" value={zip} onChange={e => setZip(e.target.value)} onKeyDown={e => e.key === 'Enter' && geoByZip()} placeholder="Zip code" maxLength={5} className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500" />
          <button type="button" onClick={geoByZip} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm transition-colors">Set</button>
          <button type="button" onClick={requestGPS} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm transition-colors">Use GPS</button>
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
