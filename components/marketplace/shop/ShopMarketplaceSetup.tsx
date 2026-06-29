'use client';

import { useState, useEffect } from 'react';

interface ShopPrefs {
  marketplaceActive: boolean;
  specialties: string[];
  holdInstructions: string;
  maxHoldsPerDay: number | null;
  notifyOnHoldRequest: boolean;
  notifyViaSms: boolean;
  smsNumber: string;
}

const SPECIALTIES = ['Commander', 'Modern', 'Legacy', 'Vintage', 'Standard', 'Pioneer', 'Draft', 'Sealed', 'Buylist', 'Foils', 'Signed', 'Alters'];

export default function ShopMarketplaceSetup() {
  const [prefs, setPrefs] = useState<ShopPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load from shop settings API
    fetch('/api/shops/settings/marketplace')
      .then(r => r.ok ? r.json() : null)
      .then((data: ShopPrefs | null) => { if (data) setPrefs(data); else setPrefs({ marketplaceActive: false, specialties: [], holdInstructions: '', maxHoldsPerDay: null, notifyOnHoldRequest: true, notifyViaSms: false, smsNumber: '' }); })
      .catch(() => setPrefs({ marketplaceActive: false, specialties: [], holdInstructions: '', maxHoldsPerDay: null, notifyOnHoldRequest: true, notifyViaSms: false, smsNumber: '' }));
  }, []);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    await fetch('/api/shops/settings/marketplace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-zinc-400">{prefs.marketplaceActive ? 'Active' : 'Inactive'}</span>
          <div
            onClick={() => setPrefs({ ...prefs, marketplaceActive: !prefs.marketplaceActive })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${prefs.marketplaceActive ? 'bg-emerald-600' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.marketplaceActive ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
          </div>
        </label>
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
          <label className="block text-sm text-zinc-400 mb-1">Max holds per day <span className="text-zinc-600">(leave blank for unlimited)</span></label>
          <input
            type="number"
            min={1}
            value={prefs.maxHoldsPerDay ?? ''}
            onChange={e => setPrefs({ ...prefs, maxHoldsPerDay: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="Unlimited"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
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
