'use client';

import { useState, useEffect } from 'react';

interface ShopPrefs {
  marketplaceActive: boolean;
  specialties: string[];
  holdInstructions: string;
  notifyViaSms: boolean;
  smsNumber: string;
  smsCountry: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
}

const SPECIALTIES = ['Commander', 'Modern', 'Legacy', 'Vintage', 'Standard', 'Pioneer', 'Draft', 'Sealed', 'Buylist', 'Foils', 'Signed', 'Alters'];

const COUNTRY_CODES = [
  { code: '+1',   flag: '🇺🇸', label: 'US/CA', digits: 10, mask: '(###) ###-####' },
  { code: '+44',  flag: '🇬🇧', label: 'UK',    digits: 10, mask: '#### ### ####' },
  { code: '+61',  flag: '🇦🇺', label: 'AU',    digits: 9,  mask: '### ### ###' },
  { code: '+64',  flag: '🇳🇿', label: 'NZ',    digits: 9,  mask: '### ### ###' },
  { code: '+49',  flag: '🇩🇪', label: 'DE',    digits: 10, mask: '#### #######' },
  { code: '+33',  flag: '🇫🇷', label: 'FR',    digits: 9,  mask: '# ## ## ## ##' },
  { code: '+34',  flag: '🇪🇸', label: 'ES',    digits: 9,  mask: '### ### ###' },
  { code: '+39',  flag: '🇮🇹', label: 'IT',    digits: 10, mask: '### ### ####' },
  { code: '+81',  flag: '🇯🇵', label: 'JP',    digits: 10, mask: '##-####-####' },
  { code: '+82',  flag: '🇰🇷', label: 'KR',    digits: 10, mask: '###-####-####' },
  { code: '+55',  flag: '🇧🇷', label: 'BR',    digits: 11, mask: '(##) #####-####' },
  { code: '+52',  flag: '🇲🇽', label: 'MX',    digits: 10, mask: '### ### ####' },
];

function applyMask(digits: string, mask: string): string {
  let di = 0;
  let out = '';
  for (const ch of mask) {
    if (di >= digits.length) break;
    if (ch === '#') { out += digits[di++]; }
    else { out += ch; }
  }
  return out;
}

function stripDigits(val: string): string {
  return val.replace(/\D/g, '');
}

async function geocodeAddress(street: string, city: string, state: string, zip: string): Promise<{ lat: number; lng: number } | null> {
  const q = [street, city, state, zip, 'USA'].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return null;
  const data = await res.json() as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export default function ShopMarketplaceSetup() {
  const [prefs, setPrefs] = useState<ShopPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/shops/settings/marketplace')
      .then(r => r.ok ? r.json() : null)
      .then((data: ShopPrefs | null) => {
        // Parse existing smsNumber back into country + local digits
        let smsCountry = '+1';
        let smsNumber = '';
        if (data?.smsNumber) {
          const match = COUNTRY_CODES.find(c => data.smsNumber.startsWith(c.code));
          if (match) {
            smsCountry = match.code;
            smsNumber = stripDigits(data.smsNumber.slice(match.code.length));
          } else {
            smsNumber = stripDigits(data.smsNumber);
          }
        }
        setPrefs(data ? { ...data, smsCountry, smsNumber } : {
          marketplaceActive: false, specialties: [], holdInstructions: '',
          notifyViaSms: false, smsNumber: '', smsCountry: '+1',
          street: '', city: '', state: '', zip: '', lat: null, lng: null,
        });
      })
      .catch(() => {});
  }, []);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError('');

    if (!prefs.city.trim() || !prefs.state.trim()) {
      setError('City and state are required.');
      setSaving(false);
      return;
    }

    let { lat, lng } = prefs;

    if (!lat || !lng) {
      const coords = await geocodeAddress(prefs.street, prefs.city, prefs.state, prefs.zip);
      if (!coords) {
        setError('Address not found. Double-check city, state, and zip.');
        setSaving(false);
        return;
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    const address = [prefs.street, prefs.city, prefs.state, prefs.zip].filter(Boolean).join(', ');

    const e164 = prefs.smsNumber ? `${prefs.smsCountry}${stripDigits(prefs.smsNumber)}` : '';

    const res = await fetch('/api/shops/settings/marketplace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prefs, address, street: prefs.street, city: prefs.city, state: prefs.state, zip: prefs.zip, lat, lng, smsNumber: e164 }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save');
    } else {
      setPrefs(p => p ? { ...p, lat, lng } : p);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
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

      <div className="space-y-3">
        <p className="text-sm text-zinc-400">Store address <span className="text-red-400">*</span> <span className="text-zinc-600 text-xs">(used for distance search)</span></p>
        <input
          type="text"
          value={prefs.street}
          onChange={e => setPrefs({ ...prefs, street: e.target.value, lat: null, lng: null })}
          placeholder="123 Main St"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">City <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={prefs.city}
              onChange={e => setPrefs({ ...prefs, city: e.target.value, lat: null, lng: null })}
              placeholder="Atlanta"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">State <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={prefs.state}
              onChange={e => setPrefs({ ...prefs, state: e.target.value.toUpperCase(), lat: null, lng: null })}
              placeholder="GA"
              maxLength={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 uppercase"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Zip code</label>
          <input
            type="text"
            value={prefs.zip}
            onChange={e => setPrefs({ ...prefs, zip: e.target.value, lat: null, lng: null })}
            placeholder="30301"
            maxLength={10}
            className="w-32 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
        {prefs.lat && prefs.lng && (
          <p className="text-xs text-emerald-500">📍 Location verified ({prefs.lat.toFixed(4)}, {prefs.lng.toFixed(4)})</p>
        )}
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

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-zinc-400">SMS for hold notifications</label>
          <button
            type="button"
            title={prefs.notifyViaSms ? 'Disable SMS notifications' : 'Enable SMS notifications'}
            onClick={() => setPrefs({ ...prefs, notifyViaSms: !prefs.notifyViaSms })}
            className={`w-10 h-5 rounded-full transition-colors relative ${prefs.notifyViaSms ? 'bg-emerald-600' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${prefs.notifyViaSms ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className={`flex gap-2 items-center transition-opacity ${prefs.notifyViaSms ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <select
            title="Country code"
            value={prefs.smsCountry}
            onChange={e => setPrefs({ ...prefs, smsCountry: e.target.value, smsNumber: '' })}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          >
            {COUNTRY_CODES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code} {c.label}</option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="numeric"
            value={(() => {
              const country = COUNTRY_CODES.find(c => c.code === prefs.smsCountry) ?? COUNTRY_CODES[0];
              return applyMask(stripDigits(prefs.smsNumber), country.mask);
            })()}
            onChange={e => {
              const country = COUNTRY_CODES.find(c => c.code === prefs.smsCountry) ?? COUNTRY_CODES[0];
              const digits = stripDigits(e.target.value).slice(0, country.digits);
              setPrefs({ ...prefs, smsNumber: digits });
            }}
            placeholder={(() => {
              const country = COUNTRY_CODES.find(c => c.code === prefs.smsCountry) ?? COUNTRY_CODES[0];
              return country.mask.replace(/#/g, '0');
            })()}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono tracking-wide"
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
          {saved ? '✓ Saved' : saving ? 'Geocoding & saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
