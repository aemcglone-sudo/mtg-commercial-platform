'use client';

import { useState, useEffect } from 'react';

interface ShopPrefs {
  marketplaceActive: boolean;
  specialties: string[];
  holdInstructions: string;
  notifyOnHoldRequest: boolean;
  notifyViaSms: boolean;
  smsNumber: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

const SPECIALTIES = ['Commander', 'Modern', 'Legacy', 'Vintage', 'Standard', 'Pioneer', 'Draft', 'Sealed', 'Buylist', 'Foils', 'Signed', 'Alters'];

export default function ShopMarketplaceSetup() {
  const [prefs, setPrefs] = useState<ShopPrefs | null>(null);
  const [zip, setZip] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/shops/settings/marketplace')
      .then(r => r.ok ? r.json() : null)
      .then((data: ShopPrefs | null) => {
        setPrefs(data ?? {
          marketplaceActive: false, specialties: [], holdInstructions: '',
          notifyOnHoldRequest: true, notifyViaSms: false,
          smsNumber: '', address: '', lat: null, lng: null,
        });
      })
      .catch(() => {});
  }, []);

  async function geocodeZip() {
    if (!/^\d{5}$/.test(zip)) { setError('Enter a valid 5-digit zip'); return; }
    setGeocoding(true);
    setError('');
    const res = await fetch(`/api/marketplace/geocode?zip=${zip}`);
    if (!res.ok) { setError('Zip not found'); setGeocoding(false); return; }
    const data = await res.json() as { lat: number; lng: number };
    setPrefs(p => p ? { ...p, lat: data.lat, lng: data.lng } : p);
    setGeocoding(false);
  }

  async function save() {
    if (!prefs) return;
    if (prefs.marketplaceActive && (!prefs.lat || !prefs.lng)) {
      setError('Set your store location (zip code) before enabling the marketplace');
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch('/api/shops/settings/marketplace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save');
    }
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  }

  function toggle(specialty: string) {
    if (!prefs) return;
    const has = prefs.specialties.includes(specialty);
    setPrefs({ ...prefs, specialties: has ? prefs.specialties.filter(s => s !== specialty) : [...prefs.specialties, specialty] });
  }

  if (!prefs) return <div className="py-6 text-zinc-600 text-sm">Loading settings…</div>;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-zinc-100">Marketplace Settings</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Control how your shop appears to local collectors</p>
        </div>
        <div
          onClick={() => setPrefs({ ...prefs, marketplaceActive: !prefs.marketplaceActive })}
          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${prefs.marketplaceActive ? 'bg-emerald-600' : 'bg-zinc-700'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.marketplaceActive ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
        </div>
      </div>

      {/* Store location — required for search */}
      <div className="space-y-2">
        <label className="block text-sm text-zinc-400">Store location <span className="text-red-400">*</span> <span className="text-zinc-600 text-xs">(required for collectors to find you)</span></label>
        {prefs.lat && prefs.lng ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-emerald-400">📍 Location set ({prefs.lat.toFixed(3)}, {prefs.lng.toFixed(3)})</span>
            <button type="button" onClick={() => setPrefs({ ...prefs, lat: null, lng: null })} className="text-xs text-zinc-600 hover:text-zinc-400 underline">Change</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <input
                type="text"
                value={prefs.address}
                onChange={e => setPrefs({ ...prefs, address: e.target.value })}
                placeholder="123 Main St, Atlanta, GA 30301"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <p className="text-xs text-zinc-600 mt-1">Then set your zip code so collectors can find you by distance:</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={zip}
                onChange={e => setZip(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && geocodeZip()}
                placeholder="Store zip code"
                maxLength={5}
                className="w-32 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={geocodeZip}
                disabled={geocoding}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {geocoding ? 'Looking up…' : 'Set Location'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Store address <span className="text-zinc-600">(shown to collectors)</span></label>
        <input
          type="text"
          value={prefs.address}
          onChange={e => setPrefs({ ...prefs, address: e.target.value })}
          placeholder="123 Main St, Atlanta, GA 30301"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-2">Specialties</label>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${prefs.specialties.includes(s) ? 'bg-emerald-700 text-emerald-100' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Hold Instructions <span className="text-zinc-600">(shown to collectors)</span></label>
        <textarea
          value={prefs.holdInstructions}
          onChange={e => setPrefs({ ...prefs, holdInstructions: e.target.value })}
          rows={2}
          placeholder="e.g. Please come within 48 hours of confirmation. Ask for John at the counter."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">SMS for hold notifications</label>
          <input
            type="tel"
            value={prefs.smsNumber}
            onChange={e => setPrefs({ ...prefs, smsNumber: e.target.value })}
            placeholder="+15551234567"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
