'use client';

import { useState, useEffect, useCallback, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ShopMarketplaceSetup from '@/components/marketplace/shop/ShopMarketplaceSetup';


function ShopSettingsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get('tab') ?? 'account') as 'account' | 'shop' | 'inventory' | 'marketplace';

  // ─── Account state ────────────────────────────────────────────────
  const [accountForm, setAccountForm] = useState({ name: '', email: '' });
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');

  // ─── Shop state ───────────────────────────────────────────────────
  const [shopForm, setShopForm] = useState({ name: '', description: '', phone: '', email: '', websiteUrl: '' });
  const [shopLoading, setShopLoading] = useState(true);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');
  const [shopSuccess, setShopSuccess] = useState('');

  // ─── Inventory upload state ───────────────────────────────────────
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [mergeMode, setMergeMode] = useState<'replace' | 'add'>('add');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [inventoryCount, setInventoryCount] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    fetch('/api/auth/account')
      .then(r => r.json())
      .then(d => { if (d.email) setAccountForm({ name: d.name ?? '', email: d.email }); })
      .finally(() => setAccountLoading(false));

    fetch('/api/shops/me')
      .then(r => r.json())
      .then(d => {
        if (!d?.shop) { router.replace('/shop/login'); return; }
        const s = d.shop;
        setShopForm({
          name: s.name === 'My Shop' ? '' : (s.name ?? ''),
          description: s.description ?? '',
          phone: s.phone ?? '',
          email: s.email ?? '',
          websiteUrl: s.websiteUrl ?? '',
        });
        setInventoryCount(d.stats?.inventoryCount ?? null);
      })
      .finally(() => setShopLoading(false));
  }, [router]);

  async function handleAccountSave(e: FormEvent) {
    e.preventDefault();
    setAccountError(''); setAccountSuccess(''); setAccountSaving(true);
    try {
      const res = await fetch('/api/auth/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: accountForm.name, email: accountForm.email }) });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setAccountError(data.error ?? 'Save failed'); return; }
      setAccountSuccess('Account updated.');
    } catch { setAccountError('Something went wrong.'); } finally { setAccountSaving(false); }
  }

  async function handleShopSave(e: FormEvent) {
    e.preventDefault();
    if (!shopForm.name.trim()) { setShopError('Store name is required.'); return; }
    setShopError(''); setShopSuccess(''); setShopSaving(true);
    try {
      const res = await fetch('/api/shops/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: shopForm.name.trim(), description: shopForm.description.trim(), phone: shopForm.phone.trim(), email: shopForm.email.trim(), websiteUrl: shopForm.websiteUrl.trim() }) });
      if (!res.ok) throw new Error('Save failed');
      setShopSuccess('Shop details saved.');
    } catch { setShopError('Something went wrong. Please try again.'); } finally { setShopSaving(false); }
  }

  // ─── Inventory upload ─────────────────────────────────────────────
  async function handleUpload() {
    if (!text.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    setUploadSuccess('');
    const startTime = Date.now();
    const interval = setInterval(() => setUploadProgress(Math.round((Date.now() - startTime) / 1000)), 500);
    try {
      const res = await fetch('/api/shops/inventory/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mergeMode }),
      });
      const text2 = await res.text();
      const data = text2 ? JSON.parse(text2) as { added?: number; skipped?: number; error?: string } : {};
      if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
      setUploadSuccess(`Added ${data.added?.toLocaleString()} card${data.added !== 1 ? 's' : ''} to inventory${data.skipped ? ` · ${data.skipped} not found` : ''}.`);
      setInventoryCount(prev => mergeMode === 'replace' ? (data.added ?? 0) : (prev ?? 0) + (data.added ?? 0));
      setText('');
      setFileName('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      clearInterval(interval);
      setUploading(false);
      setUploadProgress(0);
    }
  }

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    file.text().then(t => setText(t));
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function clearInventory() {
    setClearing(true);
    try {
      await fetch('/api/shops/inventory', { method: 'DELETE' });
      setInventoryCount(0);
    } finally { setClearing(false); setConfirmClear(false); }
  }

  const navItems = [
    { id: 'account', label: 'Account Settings' },
    { id: 'marketplace', label: 'Shop Details' },
    { id: 'inventory', label: 'Inventory Upload' },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-6 py-10 flex gap-10">
        <div className="flex-1 min-w-0">

          {/* ─── ACCOUNT ─────────────────────────────────────────────── */}
          {tab === 'account' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Account Settings</h2>
                <p className="text-sm text-zinc-500 mt-1">Update your name, email, and password.</p>
              </div>
              {accountLoading ? <p className="text-sm text-zinc-500">Loading…</p> : (
                <form onSubmit={handleAccountSave} className="space-y-4 max-w-sm">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 uppercase tracking-wide">Name</label>
                    <input type="text" placeholder="Your name" value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400 uppercase tracking-wide">Email</label>
                    <input type="email" placeholder="Email address" value={accountForm.email} onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  {accountError && <p className="text-red-400 text-sm">{accountError}</p>}
                  {accountSuccess && <p className="text-emerald-400 text-sm">{accountSuccess}</p>}
                  <button type="submit" disabled={accountSaving} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors">{accountSaving ? 'Saving…' : 'Save Changes'}</button>
                </form>
              )}
              <div className="border-t border-zinc-800 pt-6 max-w-sm space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300">Password</h3>
                <Link href="/account/password" className="inline-block px-5 py-2.5 rounded-xl text-sm border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors">Change password →</Link>
              </div>
            </section>
          )}

          {/* ─── INVENTORY UPLOAD ────────────────────────────────────── */}
          {tab === 'inventory' && (
            <section className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold">Inventory Upload</h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Upload your inventory export. We detect the format automatically.
                    {inventoryCount !== null && <span className="ml-2 text-zinc-600">{inventoryCount.toLocaleString()} cards currently in stock.</span>}
                  </p>
                </div>
                {inventoryCount !== null && inventoryCount > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    {confirmClear ? (
                      <>
                        <span className="text-xs text-zinc-400">Clear all {inventoryCount.toLocaleString()} cards?</span>
                        <button type="button" onClick={() => setConfirmClear(false)} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                        <button type="button" onClick={clearInventory} disabled={clearing} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-50">{clearing ? 'Clearing…' : 'Yes, clear all'}</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmClear(true)} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-700 transition-colors">Clear Inventory</button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <label className="block text-sm text-zinc-400 mb-3">When uploading:</label>
                  <div className="flex gap-4">
                    {(['add', 'replace'] as const).map(m => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="mergeMode" value={m} checked={mergeMode === m} onChange={() => setMergeMode(m)} className="w-4 h-4" />
                        <span className="text-sm text-zinc-200">{m === 'replace' ? '🔄 Replace inventory' : '➕ Add to inventory'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-amber-400 bg-amber-950/20' : 'border-zinc-700 hover:border-zinc-600'}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".txt,.csv,.dek,.rtf"
                    title="Upload inventory file"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="pointer-events-none space-y-1">
                    <p className="text-zinc-300 font-medium text-sm">{fileName || 'Drop your inventory file here'}</p>
                    <p className="text-zinc-600 text-xs">MTGO, Moxfield, ManaBox, Deckbox, or TCGPlayer · or paste below</p>
                  </div>
                </div>

                <textarea
                  className="w-full h-28 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500 font-mono"
                  placeholder={`4 Lightning Bolt\n4 Counterspell\n20 Island`}
                  value={text}
                  onChange={e => { setText(e.target.value); setFileName(''); setUploadSuccess(''); setUploadError(''); }}
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
                      <p className="text-xs text-zinc-500">{uploadProgress}s elapsed · large lists take 60–90s</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!text.trim() || uploading}
                  onClick={handleUpload}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Processing…' : mergeMode === 'replace' ? '🔄 Replace inventory' : '➕ Add to inventory'}
                </button>
              </div>
            </section>
          )}

          {/* ─── SHOP DETAILS + MARKETPLACE SETUP ──────────────────── */}
          {tab === 'marketplace' && (
            <section className="space-y-8">
              <div>
                <h2 className="text-base font-semibold">Shop Details</h2>
                <p className="text-sm text-zinc-500 mt-1">Your storefront information and marketplace settings.</p>
              </div>

              {shopLoading ? <p className="text-sm text-zinc-500">Loading…</p> : (
                <form onSubmit={handleShopSave} className="space-y-6 max-w-lg">
                  <section className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Store identity</h3>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Store name <span className="text-red-400">*</span></label>
                      <input type="text" required placeholder="e.g. Dragon's Hoard Cards" value={shopForm.name} onChange={e => setShopForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
                      <textarea rows={3} placeholder="What makes your store special?" value={shopForm.description} onChange={e => setShopForm(p => ({ ...p, description: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors resize-none" />
                    </div>
                  </section>
                  <section className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contact</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
                        <input type="email" placeholder="shop@example.com" value={shopForm.email} onChange={e => setShopForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone</label>
                        <input type="tel" placeholder="(512) 555-0100" value={shopForm.phone} onChange={e => setShopForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Website</label>
                      <input type="url" placeholder="https://yourshop.com" value={shopForm.websiteUrl} onChange={e => setShopForm(p => ({ ...p, websiteUrl: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                    </div>
                  </section>
                  {shopError && <p className="text-red-400 text-sm">{shopError}</p>}
                  {shopSuccess && <p className="text-emerald-400 text-sm">{shopSuccess}</p>}
                  <button type="submit" disabled={shopSaving} className="px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors text-sm">{shopSaving ? 'Saving…' : 'Save'}</button>
                </form>
              )}

              <div className="border-t border-zinc-800 pt-8">
                <ShopMarketplaceSetup />
              </div>
            </section>
          )}
        </div>

        {/* Right nav */}
        <nav className="w-44 shrink-0 space-y-1 pt-1">
          {navItems.map(item => (
            <Link key={item.id} href={`/shop/settings?tab=${item.id}`}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === item.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function ShopSettingsPage() {
  return <Suspense><ShopSettingsContent /></Suspense>;
}
