'use client';

import { useState, useEffect, useRef, useCallback, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

interface ReviewCard {
  found: boolean; qty: number; name: string;
  scryfallId?: string; cardName?: string; setCode?: string;
  collectorNumber?: string; imageUrl?: string | null;
  marketPriceCents?: number | null; priceCents: number;
  condition: string; foil: boolean; include: boolean;
  typeLine?: string | null; colors?: string[]; cmc?: number | null; rarity?: string | null;
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function ShopSettingsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get('tab') ?? 'account') as 'account' | 'shop' | 'inventory';

  // ─── Account state ────────────────────────────────────────────────
  const [accountForm, setAccountForm] = useState({ name: '', email: '' });
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');

  // ─── Shop state ───────────────────────────────────────────────────
  const [shopForm, setShopForm] = useState({ name: '', description: '', city: '', state: '', phone: '', email: '', websiteUrl: '' });
  const [shopLoading, setShopLoading] = useState(true);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');
  const [shopSuccess, setShopSuccess] = useState('');

  // ─── Inventory upload state ───────────────────────────────────────
  const [pasteText, setPasteText] = useState('');
  const [parseLoading, setParseLoading] = useState(false);
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [notFoundCount, setNotFoundCount] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);
  const [inventoryCount, setInventoryCount] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
          city: s.city ?? '',
          state: s.state ?? '',
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
      const res = await fetch('/api/shops/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: shopForm.name.trim(), description: shopForm.description.trim(), city: shopForm.city.trim(), state: shopForm.state, phone: shopForm.phone.trim(), email: shopForm.email.trim(), websiteUrl: shopForm.websiteUrl.trim() }) });
      if (!res.ok) throw new Error('Save failed');
      setShopSuccess('Shop details saved.');
    } catch { setShopError('Something went wrong. Please try again.'); } finally { setShopSaving(false); }
  }

  // ─── Inventory upload ─────────────────────────────────────────────
  const parseText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setParseLoading(true);
    setReviewCards([]);
    setNotFoundCount(0);
    setAddResult(null);
    try {
      const res = await fetch('/api/shops/parse-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = await res.json() as { results: ReviewCard[]; notFoundCount: number };
      setReviewCards((data.results ?? []).map(r => ({ ...r, include: r.found })));
      setNotFoundCount(data.notFoundCount ?? 0);
    } catch { /* ignore */ } finally { setParseLoading(false); }
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => parseText(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  }

  async function confirmAdd() {
    const toAdd = reviewCards.filter(c => c.include && c.found && c.scryfallId);
    if (!toAdd.length) return;
    setAdding(true); setAddResult(null);
    try {
      const res = await fetch('/api/shops/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: toAdd.map(c => ({ scryfallId: c.scryfallId!, cardName: c.cardName ?? c.name, setCode: c.setCode ?? '', collectorNumber: c.collectorNumber, condition: c.condition, foil: c.foil, quantity: c.qty, priceCents: c.priceCents, imageUrl: c.imageUrl, typeLine: c.typeLine, colors: c.colors, cmc: c.cmc, rarity: c.rarity })) }),
      });
      const data = await res.json() as { added: number };
      setAddResult(`Added ${data.added} card${data.added !== 1 ? 's' : ''} to inventory.`);
      setReviewCards([]);
      setPasteText('');
      setInventoryCount(prev => (prev ?? 0) + data.added);
    } catch { /* ignore */ } finally { setAdding(false); }
  }

  async function clearInventory() {
    setClearing(true);
    try {
      await fetch('/api/shops/inventory', { method: 'DELETE' });
      setInventoryCount(0);
    } finally { setClearing(false); setConfirmClear(false); }
  }

  function updateReview(i: number, patch: Partial<ReviewCard>) {
    setReviewCards(prev => { const next = [...prev]; next[i] = { ...next[i], ...patch }; return next; });
  }

  const includedCount = reviewCards.filter(c => c.include && c.found).length;

  const navItems = [
    { id: 'account', label: 'Account Settings' },
    { id: 'shop', label: 'Shop Details' },
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

          {/* ─── SHOP ────────────────────────────────────────────────── */}
          {tab === 'shop' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Shop Details</h2>
                <p className="text-sm text-zinc-500 mt-1">Update your storefront information.</p>
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
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Location</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">City</label>
                        <input type="text" placeholder="e.g. Austin" value={shopForm.city} onChange={e => setShopForm(p => ({ ...p, city: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">State</label>
                        <select title="State" value={shopForm.state} onChange={e => setShopForm(p => ({ ...p, state: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors">
                          <option value="">Select…</option>
                          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
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
                  <button type="submit" disabled={shopSaving} className="px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors text-sm">{shopSaving ? 'Saving…' : 'Save Shop Details'}</button>
                </form>
              )}
            </section>
          )}

          {/* ─── INVENTORY UPLOAD ────────────────────────────────────── */}
          {tab === 'inventory' && (
            <section className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold">Inventory Upload</h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Paste or upload a card list to add to your inventory.
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

              {/* Paste area */}
              <div className="space-y-3">
                <label className="text-xs text-zinc-400 uppercase tracking-wide">Paste card list</label>
                <textarea
                  rows={8}
                  placeholder={'1 Black Lotus\n4 Brainstorm\n2x Lightning Bolt\n…'}
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setReviewCards([]); setAddResult(null); }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors font-mono resize-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => parseText(pasteText)}
                    disabled={!pasteText.trim() || parseLoading}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-colors"
                  >
                    {parseLoading ? 'Parsing…' : 'Parse List'}
                  </button>
                  <label className="px-5 py-2.5 rounded-xl text-sm font-medium border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 cursor-pointer transition-colors">
                    Upload File
                    <input ref={fileRef} type="file" accept=".txt,.csv,.dek,.rtf" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {/* Parsing spinner */}
              {parseLoading && (
                <div className="flex items-center gap-3 py-6 text-zinc-400 text-sm">
                  <svg className="w-5 h-5 animate-spin text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Looking up cards on Scryfall…
                </div>
              )}

              {/* Review cards */}
              {!parseLoading && reviewCards.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-400">
                      {includedCount} card{includedCount !== 1 ? 's' : ''} ready to add
                      {notFoundCount > 0 && <span className="text-zinc-600 ml-2">· {notFoundCount} not found</span>}
                    </p>
                    <button
                      type="button"
                      onClick={confirmAdd}
                      disabled={adding || includedCount === 0}
                      className="px-5 py-2 rounded-xl text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-colors"
                    >
                      {adding ? 'Adding…' : `Add ${includedCount} to Inventory`}
                    </button>
                  </div>

                  <div className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/60">
                    {reviewCards.map((card, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 text-sm ${!card.found ? 'opacity-40' : ''}`}>
                        <input
                          type="checkbox"
                          aria-label={`Include ${card.cardName ?? card.name ?? ''}`}
                          checked={card.include && card.found}
                          disabled={!card.found}
                          onChange={e => updateReview(i, { include: e.target.checked })}
                          className="shrink-0 accent-amber-400"
                        />
                        {card.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={card.imageUrl} alt="" className="w-7 h-9 object-cover rounded shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{card.cardName ?? card.name}</p>
                          <p className="text-xs text-zinc-500">{card.setCode?.toUpperCase()} {card.found ? '' : '— not found'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number" min={1}
                            title="Quantity"
                            placeholder="1"
                            value={card.qty}
                            onChange={e => updateReview(i, { qty: parseInt(e.target.value) || 1 })}
                            className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-center text-zinc-200 focus:outline-none focus:border-amber-500"
                          />
                          <select
                            title="Condition"
                            value={card.condition}
                            onChange={e => updateReview(i, { condition: e.target.value })}
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                          >
                            {['NM','LP','MP','HP','DMG'].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {card.marketPriceCents != null && (
                            <span className="text-xs text-amber-400 w-14 text-right">{fmt(card.priceCents)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {addResult && (
                <p className="text-emerald-400 text-sm">{addResult}</p>
              )}
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
