'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import LogoutButton from '@/components/LogoutButton';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

function ShopSettingsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get('tab') ?? 'account') as 'account' | 'shop';

  // Account state
  const [accountForm, setAccountForm] = useState({ name: '', email: '' });
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');

  // Shop state
  const [shopForm, setShopForm] = useState({ name: '', description: '', city: '', state: '', phone: '', email: '', websiteUrl: '' });
  const [shopLoading, setShopLoading] = useState(true);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');
  const [shopSuccess, setShopSuccess] = useState('');

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
      })
      .finally(() => setShopLoading(false));
  }, [router]);

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

  async function handleShopSave(e: FormEvent) {
    e.preventDefault();
    if (!shopForm.name.trim()) { setShopError('Store name is required.'); return; }
    setShopError('');
    setShopSuccess('');
    setShopSaving(true);
    try {
      const res = await fetch('/api/shops/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: shopForm.name.trim(),
          description: shopForm.description.trim(),
          city: shopForm.city.trim(),
          state: shopForm.state,
          phone: shopForm.phone.trim(),
          email: shopForm.email.trim(),
          websiteUrl: shopForm.websiteUrl.trim(),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setShopSuccess('Shop details saved.');
    } catch {
      setShopError('Something went wrong. Please try again.');
    } finally {
      setShopSaving(false);
    }
  }

  const navItems = [
    { id: 'account', label: 'Account Settings' },
    { id: 'shop', label: 'Shop Details' },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/shop/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Back</Link>
            <h1 className="text-lg font-bold">Settings</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

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
                  <button type="submit" disabled={accountSaving} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors">
                    {accountSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </form>
              )}
              <div className="border-t border-zinc-800 pt-6 max-w-sm space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300">Password</h3>
                <Link href="/account/password" className="inline-block px-5 py-2.5 rounded-xl text-sm border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors">
                  Change password →
                </Link>
              </div>
            </section>
          )}

          {tab === 'shop' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Shop Details</h2>
                <p className="text-sm text-zinc-500 mt-1">Update your storefront information.</p>
              </div>
              {shopLoading ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : (
                <form onSubmit={handleShopSave} className="space-y-6 max-w-lg">
                  <section className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Store identity</h3>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Store name <span className="text-red-400">*</span></label>
                      <input type="text" required placeholder="e.g. Dragon's Hoard Cards" value={shopForm.name}
                        onChange={e => setShopForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
                      <textarea rows={3} placeholder="What makes your store special?" value={shopForm.description}
                        onChange={e => setShopForm(p => ({ ...p, description: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors resize-none" />
                    </div>
                  </section>
                  <section className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Location</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">City</label>
                        <input type="text" placeholder="e.g. Austin" value={shopForm.city}
                          onChange={e => setShopForm(p => ({ ...p, city: e.target.value }))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">State</label>
                        <select value={shopForm.state} onChange={e => setShopForm(p => ({ ...p, state: e.target.value }))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors">
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
                        <input type="email" placeholder="shop@example.com" value={shopForm.email}
                          onChange={e => setShopForm(p => ({ ...p, email: e.target.value }))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone</label>
                        <input type="tel" placeholder="(512) 555-0100" value={shopForm.phone}
                          onChange={e => setShopForm(p => ({ ...p, phone: e.target.value }))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Website</label>
                      <input type="url" placeholder="https://yourshop.com" value={shopForm.websiteUrl}
                        onChange={e => setShopForm(p => ({ ...p, websiteUrl: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors" />
                    </div>
                  </section>
                  {shopError && <p className="text-red-400 text-sm">{shopError}</p>}
                  {shopSuccess && <p className="text-emerald-400 text-sm">{shopSuccess}</p>}
                  <button type="submit" disabled={shopSaving} className="px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors text-sm">
                    {shopSaving ? 'Saving…' : 'Save Shop Details'}
                  </button>
                </form>
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
