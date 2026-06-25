'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ShopStats {
  inventoryCount: number;
  totalValueCents: number;
  pendingOrders: number;
  revenueThisMonthCents: number;
}

export default function ShopDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [shopName, setShopName] = useState<string>('Your Shop');
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch('/api/shops/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data?.shop) return;
        setShopName(data.shop.name);
        setStats(data.stats);
        if (data.shop.isNew) {
          router.replace('/shop/setup');
        } else {
          setIsNew(false);
        }
      })
      .catch(() => {});
  }, [router]);

  const statCards = [
    {
      label: 'Cards in Stock',
      value: stats?.inventoryCount.toLocaleString() ?? '—',
      icon: '🃏',
    },
    {
      label: 'Inventory Value',
      value: stats ? `$${(stats.totalValueCents / 100).toFixed(2)}` : '—',
      icon: '💰',
    },
    {
      label: 'Pending Orders',
      value: stats?.pendingOrders.toLocaleString() ?? '—',
      icon: '📦',
    },
    {
      label: 'Revenue This Month',
      value: stats ? `$${(stats.revenueThisMonthCents / 100).toFixed(2)}` : '—',
      icon: '📈',
    },
  ];

  return (
    <div className="min-h-screen text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Welcome back</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2"
            >
              <span className="text-2xl">{s.icon}</span>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/shop/inventory?action=scan"
              className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-4 transition-colors group"
            >
              <span className="text-2xl">📷</span>
              <div>
                <div className="font-semibold group-hover:text-amber-400 transition-colors">
                  Scan Cards
                </div>
                <div className="text-xs text-zinc-500">Add inventory via camera</div>
              </div>
            </Link>
            <Link
              href="/shop/inventory"
              className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-4 transition-colors group"
            >
              <span className="text-2xl">📋</span>
              <div>
                <div className="font-semibold group-hover:text-amber-400 transition-colors">
                  Manage Inventory
                </div>
                <div className="text-xs text-zinc-500">View, edit, and price cards</div>
              </div>
            </Link>
            <Link
              href="/shop/orders"
              className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-4 transition-colors group"
            >
              <span className="text-2xl">📦</span>
              <div>
                <div className="font-semibold group-hover:text-amber-400 transition-colors">
                  View Orders
                </div>
                <div className="text-xs text-zinc-500">Fulfill pending orders</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Setup prompt */}
        {isNew && (
          <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-6 text-center space-y-3">
            <div className="font-semibold text-amber-400">Finish setting up your storefront</div>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto">
              Add your shop name, location, and contact details so collectors can find you.
            </p>
            <Link
              href="/shop/setup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors text-sm"
            >
              Complete setup
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
