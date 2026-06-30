'use client';

import { useState, useCallback, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

interface SavedInfo {
  collectionSize: number;
  totalCards: number;
  detectedFormat: string;
  savedAt: string;
}

function SettingsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get('tab') ?? 'account') as 'account' | 'upload' | 'location';

  // Account state
  const [accountForm, setAccountForm] = useState({ name: '', email: '' });
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');

  // Location state
  const [locForm, setLocForm] = useState({ street: '', city: '', state: '', zip: '' });
  const [locationStatus, setLocationStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [locationMsg, setLocationMsg] = useState('');
  const [locCoords, setLocCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Upload state
  const [saved, setSaved] = useState<SavedInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [mergeMode, setMergeMode] = useState<'replace' | 'add'>('replace');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetch('/api/auth/account')
      .then(r => r.json())
      .then(d => { if (d.name !== undefined) setAccountForm({ name: d.name ?? '', email: d.email ?? '' }); })
      .finally(() => setAccountLoading(false));
    fetch('/api/marketplace/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((p: { lat: number | null; lng: number | null } | null) => {
        if (p?.lat && p?.lng) setLocCoords({ lat: p.lat, lng: p.lng });
      })
      .catch(() => {});
    fetch('/api/collection/saved')
      .then(r => r.json())
      .then(d => { if (d) setSaved(d); })
      .finally(() => setLoadingInfo(false));
  }, []);

  async function handleAccountSave(e: FormEvent) {
    e.preventDefault();
    setAccountError('');
    setAccountSuccess('');
    setAccountSaving(true);
    try {
      const res = await fetch('/api/auth/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountForm.name, email: accountForm.email }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setAccountError(data.error ?? 'Save failed'); return; }
      setAccountSuccess('Account updated.');
    } catch {
      setAccountError('Something went wrong.');
    } finally {
      setAccountSaving(false);
    }
  }

  async function saveLocation(lat: number, lng: number) {
    setLocationStatus('saving');
    setLocationMsg('');
    try {
      const res = await fetch('/api/marketplace/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      if (!res.ok) throw new Error('Save failed');
      setLocCoords({ lat, lng });
      setLocationStatus('saved');
      setLocationMsg('Location saved. It\'s only visible to you.');
    } catch {
      setLocationStatus('error');
      setLocationMsg('Could not save location. Please try again.');
    }
  }

  async function handleAddressSave() {
    if (!locForm.city.trim() || !locForm.state.trim()) {
      setLocationStatus('error');
      setLocationMsg('City and state are required.');
      return;
    }
    setLocationStatus('saving');
    setLocationMsg('Validating address…');
    try {
      const q = [locForm.street, locForm.city, locForm.state, locForm.zip, 'USA'].filter(Boolean).join(', ');
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json() as Array<{ lat: string; lon: string }>;
      if (!data.length) { setLocationStatus('error'); setLocationMsg('Address not found. Double-check city, state, and zip.'); return; }
      await saveLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
    } catch {
      setLocationStatus('error');
      setLocationMsg('Could not validate address. Check your connection.');
    }
  }

  function handleGPS() {
    setLocationStatus('saving');
    setLocationMsg('Getting GPS location…');
    navigator.geolocation.getCurrentPosition(
      pos => saveLocation(pos.coords.latitude, pos.coords.longitude),
      () => { setLocationStatus('error'); setLocationMsg('Could not get GPS location. Try entering your address.'); }
    );
  }

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    file.text().then(raw => {
      if (file.name.toLowerCase().endsWith('.rtf')) {
        // Strip RTF control codes to get plain text
        let text = raw
          .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))) // decode hex escapes like \'c9 → É
          .replace(/\{[^{}]*\}/g, ' ')           // remove groups like {\colortbl...}
          .replace(/\\[a-z]+[-]?\d*[ ]?/g, ' ')  // remove control words like \rtf1 \b \par
          .replace(/\\\*/g, '')                   // remove \* escaped destinations
          .replace(/[{}\\]/g, ' ')               // remove remaining braces/backslashes
          .replace(/[ \t]+/g, ' ')               // collapse whitespace
          .split('\n').map(l => l.trim()).filter(Boolean).join('\n');
        setText(text);
      } else {
        setText(raw);
      }
    });
    setUploadSuccess('');
    setUploadError('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  async function handleUpload() {
    if (!text.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    setUploadSuccess('');
    const startTime = Date.now();
    const interval = setInterval(() => setUploadProgress(Math.round((Date.now() - startTime) / 1000)), 500);
    try {
      const res = await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, collectionType: 'paper', mergeMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setSaved({ collectionSize: data.collectionSize, totalCards: data.totalCards, detectedFormat: data.detectedFormat, savedAt: new Date().toISOString() });
      setUploadSuccess(`Saved! ${data.collectionSize.toLocaleString()} unique cards detected.`);
      setText('');
      setFileName('');
      // Notify layout to check for new combos
      if (data.cardNames && Array.isArray(data.cardNames)) {
        window.dispatchEvent(new CustomEvent('collection-updated', { detail: data.cardNames }));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      clearInterval(interval);
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleClear() {
    if (!confirm('Remove your saved collection? You can re-upload at any time.')) return;
    setClearing(true);
    await fetch('/api/collection/saved', { method: 'DELETE' });
    setSaved(null);
    setClearing(false);
  }

  const navItems = [
    { id: 'account', label: 'Account Settings' },
    { id: 'upload', label: 'Upload Collection' },
    { id: 'location', label: 'My Location' },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-6 py-10 flex gap-10">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {tab === 'account' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Account Settings</h2>
                <p className="text-sm text-zinc-500 mt-1">Update your name, email, and password.</p>
              </div>

              {accountLoading ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : (
                <form onSubmit={handleAccountSave} className="space-y-4 max-w-sm">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 uppercase tracking-wide">Name</label>
                    <input
                      type="text" placeholder="Your name" value={accountForm.name}
                      onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 uppercase tracking-wide">Email</label>
                    <input
                      type="email" placeholder="Email address" value={accountForm.email}
                      onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  {accountError && <p className="text-red-400 text-sm">{accountError}</p>}
                  {accountSuccess && <p className="text-emerald-400 text-sm">{accountSuccess}</p>}

                  <button
                    type="submit" disabled={accountSaving}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
                  >
                    {accountSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </form>
              )}

              <div className="border-t border-zinc-800 pt-6 max-w-sm space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300">Password</h3>
                <Link
                  href="/account/password"
                  className="inline-block px-5 py-2.5 rounded-xl text-sm border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                >
                  Change password →
                </Link>
              </div>
            </section>
          )}

          {tab === 'location' && (
            <section className="space-y-6 max-w-sm">
              <div>
                <h2 className="text-base font-semibold">My Location</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Set your home neighborhood so we can surface the closest local game stores when you search for cards.
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 space-y-1">
                <p className="text-sm font-medium text-zinc-200">🔒 Your location is completely private</p>
                <p className="text-sm text-zinc-500">
                  It is never shared with store owners, other collectors, or any third party. We use it only on your device to sort nearby stores by distance and to place your marker on hold request maps — nothing else.
                </p>
              </div>

              {locCoords && (
                <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl px-4 py-3 text-sm text-emerald-300">
                  ✅ Location set · {locCoords.lat.toFixed(4)}, {locCoords.lng.toFixed(4)}
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 uppercase tracking-wide">Street address</label>
                  <input
                    type="text"
                    value={locForm.street}
                    onChange={e => { setLocForm(f => ({ ...f, street: e.target.value })); setLocationStatus('idle'); setLocationMsg(''); }}
                    placeholder="123 Main St"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 uppercase tracking-wide">City <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={locForm.city}
                      onChange={e => { setLocForm(f => ({ ...f, city: e.target.value })); setLocationStatus('idle'); setLocationMsg(''); }}
                      placeholder="Atlanta"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 uppercase tracking-wide">State <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={locForm.state}
                      onChange={e => { setLocForm(f => ({ ...f, state: e.target.value })); setLocationStatus('idle'); setLocationMsg(''); }}
                      placeholder="GA"
                      maxLength={2}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors uppercase"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 uppercase tracking-wide">Zip code</label>
                  <input
                    type="text"
                    value={locForm.zip}
                    onChange={e => { setLocForm(f => ({ ...f, zip: e.target.value })); setLocationStatus('idle'); setLocationMsg(''); }}
                    placeholder="30002"
                    maxLength={10}
                    className="w-40 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {locationMsg && (
                  <p className={`text-sm ${locationStatus === 'error' ? 'text-red-400' : locationStatus === 'saved' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {locationMsg}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleAddressSave}
                  disabled={!locForm.city.trim() || !locForm.state.trim() || locationStatus === 'saving'}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {locationStatus === 'saving' ? 'Validating & saving…' : 'Save Location'}
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs text-zinc-600">or</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                <button
                  type="button"
                  onClick={handleGPS}
                  disabled={locationStatus === 'saving'}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40 transition-colors"
                >
                  📍 Use my current GPS location
                </button>
              </div>
            </section>
          )}

          {tab === 'upload' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Upload Collection</h2>
                <p className="text-sm text-zinc-500 mt-1">Upload your Magic collection export. We detect the format automatically.</p>
              </div>

              {!loadingInfo && saved && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-zinc-200">
                      {saved.collectionSize.toLocaleString()} unique cards · {saved.totalCards.toLocaleString()} total
                    </p>
                    <p className="text-xs text-zinc-500">
                      {saved.detectedFormat && saved.detectedFormat !== 'Unknown' ? `${saved.detectedFormat} · ` : ''}
                      Saved {new Date(saved.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href="/" className="px-3 py-1.5 text-xs rounded-lg bg-amber-400 text-black font-medium hover:bg-amber-300 transition-colors">View</Link>
                    <button type="button" onClick={handleClear} disabled={clearing} className="px-3 py-1.5 text-xs rounded-lg text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors">
                      {clearing ? 'Clearing…' : 'Clear'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <label className="block text-sm text-zinc-400 mb-3">When uploading:</label>
                  <div className="flex gap-4">
                    {(['replace', 'add'] as const).map(m => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="mergeMode" value={m} checked={mergeMode === m} onChange={() => setMergeMode(m)} className="w-4 h-4" />
                        <span className="text-sm text-zinc-200">{m === 'replace' ? '🔄 Replace collection' : '➕ Add to collection'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-amber-400 bg-amber-950/20' : 'border-zinc-700 hover:border-zinc-600'}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input type="file" accept=".txt,.csv,.dek,.rtf" title="Upload collection file" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="pointer-events-none space-y-1">
                    <p className="text-zinc-300 font-medium text-sm">{fileName || 'Drop your collection file here'}</p>
                    <p className="text-zinc-600 text-xs">MTGO, Moxfield, ManaBox, Deckbox, or TCGPlayer · or paste below</p>
                  </div>
                </div>

                <textarea
                  className="w-full h-28 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500 font-mono"
                  placeholder={`4 Lightning Bolt\n4 Counterspell\n20 Island`}
                  value={text}
                  onChange={(e) => { setText(e.target.value); setFileName(''); setUploadSuccess(''); setUploadError(''); }}
                />

                {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}
                {uploadSuccess && <p className="text-emerald-400 text-sm">{uploadSuccess}</p>}

                {uploading && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <svg className="animate-spin h-4 w-4 shrink-0 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <div>
                      <p className="text-sm text-zinc-200">{uploadProgress < 3 ? 'Parsing…' : uploadProgress < 10 ? 'Looking up cards…' : 'Enriching card data…'}</p>
                      <p className="text-xs text-zinc-500">{uploadProgress}s elapsed · large collections take 60–90s</p>
                    </div>
                  </div>
                )}

                <button
                  type="button" disabled={!text.trim() || uploading} onClick={handleUpload}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Processing…' : mergeMode === 'replace' ? '🔄 Replace collection' : '➕ Add to collection'}
                </button>
                <p className="text-center text-xs text-zinc-600">Export from Moxfield → Collection → Export → MTGO Format</p>
              </div>
            </section>
          )}
        </div>

        {/* Right nav */}
        <nav className="w-44 shrink-0 space-y-1 pt-1">
          {navItems.map(item => (
            <Link
              key={item.id}
              href={`/settings?tab=${item.id}`}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense><SettingsContent /></Suspense>;
}
