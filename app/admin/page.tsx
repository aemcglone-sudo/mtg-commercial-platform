'use client';

import { useEffect, useState } from 'react';

interface Stats {
  totalUsers: number;
  totalShops: number;
  totalCollectors: number;
  totalShopOwners: number;
  totalShopInventory: number;
  totalCollectionItems: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers },
    { label: 'Collectors', value: stats?.totalCollectors },
    { label: 'Shop Owners', value: stats?.totalShopOwners },
    { label: 'Shops', value: stats?.totalShops },
    { label: 'Shop Inventory', value: stats?.totalShopInventory },
    { label: 'Collection Items', value: stats?.totalCollectionItems },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black text-zinc-100">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Platform overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-2xl font-bold text-zinc-100">
              {c.value !== undefined ? c.value.toLocaleString() : '—'}
            </p>
            <p className="text-sm text-zinc-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
