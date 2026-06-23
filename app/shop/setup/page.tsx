'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

interface ShopData {
  name: string;
  description: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  websiteUrl: string;
}

export default function ShopSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ShopData>({
    name: '',
    description: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    websiteUrl: '',
  });

  useEffect(() => {
    fetch('/api/shops/me')
      .then(r => r.json())
      .then(data => {
        if (!data?.shop) { router.replace('/login'); return; }
        const s = data.shop;
        setForm({
          name: s.name === 'My Shop' ? '' : (s.name ?? ''),
          description: s.description ?? '',
          city: s.city ?? '',
          state: s.state ?? '',
          phone: s.phone ?? '',
          email: s.email ?? '',
          websiteUrl: s.websiteUrl ?? '',
        });
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  function set(field: keyof ShopData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Store name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/shops/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          city: form.city.trim(),
          state: form.state,
          phone: form.phone.trim(),
          email: form.email.trim(),
          websiteUrl: form.websiteUrl.trim(),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      router.push('/shop/inventory');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <span className="text-xl font-black text-amber-400">Grimoire</span>
          <Link href="/shop/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Skip for now
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Set up your storefront</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Tell collectors who you are. You can update this anytime from Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Store identity */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Store identity</h2>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Store name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dragon's Hoard Cards"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Description <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="What makes your store special? Specialties, buying/trading policies, turnaround time…"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>
          </section>

          {/* Location */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Location</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">City</label>
                <input
                  type="text"
                  placeholder="e.g. Austin"
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">State</label>
                <select
                  value={form.state}
                  onChange={e => set('state', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">Select…</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="shop@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone</label>
                <input
                  type="tel"
                  placeholder="(512) 555-0100"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Website</label>
              <input
                type="url"
                placeholder="https://dragonshoard.com"
                value={form.websiteUrl}
                onChange={e => set('websiteUrl', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </section>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? 'Saving…' : 'Save & Continue to Inventory'}
            </button>
            <Link href="/shop/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              Skip
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
