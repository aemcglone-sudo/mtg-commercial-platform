'use client';

import { useEffect, useState } from 'react';

interface Shop {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  email: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string;
  inventoryCount: number;
}

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/shops').then(r => r.json()).then(d => setShops(d.shops ?? [])).finally(() => setLoading(false));
  }, []);

  const filtered = shops.filter(s =>
    search === '' ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
    (s.ownerName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-100">Shops</h1>
          <p className="text-zinc-500 text-sm mt-1">{shops.length} total</p>
        </div>
        <input
          type="search"
          placeholder="Search shops or owners…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-64 transition-colors"
        />
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Shop</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Owner</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Location</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Inventory</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-zinc-200 font-medium">{s.name}</p>
                    {s.email && <p className="text-zinc-600 text-xs mt-0.5">{s.email}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-zinc-300">{s.ownerName || <span className="text-zinc-600 italic">—</span>}</p>
                    <p className="text-zinc-600 text-xs mt-0.5">{s.ownerEmail}</p>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400">
                    {s.city && s.state ? `${s.city}, ${s.state}` : s.city || s.state || <span className="text-zinc-600 italic">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-300 font-medium">
                    {s.inventoryCount.toLocaleString()} cards
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500">
                    {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-600">No shops found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
