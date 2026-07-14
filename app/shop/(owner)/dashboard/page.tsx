'use client';

import Link from 'next/link';
import { CardNameLink } from '@/components/CardNameLink';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PriceAlert } from '@/app/api/shops/price-alerts/route';
import ShopInventoryInsightsTab from '@/components/ShopInventoryInsightsTab';
import ShopInventoryVariants from '@/components/ShopInventoryVariants';

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
  const [priceAlerts, setPriceAlerts] = useState<{ up: PriceAlert[]; down: PriceAlert[] } | null>(null);
  const [staleCount, setStaleCount] = useState(0);

  useEffect(() => {
    fetch('/api/shops/me')
      .then(r => r.json())
      .then(data => {
        if (!data?.shop) return;
        setShopName(data.shop.name);
        setStats(data.stats);
        if (data.shop.isNew) router.replace('/shop/setup');
        fetch('/api/shops/refresh-prices', { method: 'POST' }).catch(() => {});
      })
      .catch(() => {});
    fetch('/api/shops/price-alerts')
      .then(r => r.json())
      .then(d => setPriceAlerts(d))
      .catch(() => {});
    fetch('/api/shops/pricing/stale-ids')
      .then(r => r.json())
      .then((d) => setStaleCount(d.ids?.length ?? 0))
      .catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div>
          <h1 className="text-xl font-bold">{shopName}</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Dashboard</p>
        </div>

        {staleCount > 0 && (
          <Link href="/shop/collection?tab=inventory"
            className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-700/40 hover:border-yellow-500/60 rounded-xl p-4 transition-colors group">
            <span className="text-xl">⚠</span>
            <div>
              <div className="font-semibold text-yellow-300 group-hover:text-yellow-200 transition-colors text-sm">
                {staleCount} stale price{staleCount !== 1 ? 's' : ''} — market has moved &gt;10% since last update
              </div>
              <div className="text-xs text-yellow-600">Click to review in Inventory →</div>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cards in Stock', value: stats?.inventoryCount.toLocaleString() ?? '—', icon: '🃏' },
            { label: 'Inventory Value', value: stats ? `$${(stats.totalValueCents / 100).toFixed(2)}` : '—', icon: '💰' },
            { label: 'Pending Orders', value: stats?.pendingOrders.toLocaleString() ?? '—', icon: '📦' },
            { label: 'Revenue This Month', value: stats ? `$${(stats.revenueThisMonthCents / 100).toFixed(2)}` : '—', icon: '📈' },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
              <span className="text-xl">{s.icon}</span>
              <div className="text-xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        {priceAlerts && (priceAlerts.up.length > 0 || priceAlerts.down.length > 0) && (
          <div>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Price Movements (48h)</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[...priceAlerts.up.slice(0, 5), ...priceAlerts.down.slice(0, 5)].map(alert => (
                <div key={alert.scryfallId}
                  className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-3 min-w-44 space-y-1">
                  <div className="text-xs text-zinc-400 truncate font-medium"><CardNameLink name={alert.cardName} /></div>
                  <div className={`text-sm font-bold ${alert.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {alert.delta > 0 ? '+' : ''}{alert.delta.toFixed(0)}%
                  </div>
                  <div className="text-xs text-zinc-600">
                    ${(alert.prevCents / 100).toFixed(2)} → ${(alert.currentCents / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Link href="/shop/inventory?action=scan"
            className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-4 transition-colors group">
            <span className="text-xl">📷</span>
            <div>
              <div className="text-sm font-semibold group-hover:text-amber-400 transition-colors">Scan Cards</div>
              <div className="text-xs text-zinc-500">Add inventory via camera</div>
            </div>
          </Link>
          <Link href="/shop/collection?tab=inventory"
            className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-4 transition-colors group">
            <span className="text-xl">📋</span>
            <div>
              <div className="text-sm font-semibold group-hover:text-amber-400 transition-colors">Manage Inventory</div>
              <div className="text-xs text-zinc-500">View, edit, and price cards</div>
            </div>
          </Link>
          <Link href="/shop/orders"
            className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-4 transition-colors group">
            <span className="text-xl">📦</span>
            <div>
              <div className="text-sm font-semibold group-hover:text-amber-400 transition-colors">View Orders</div>
              <div className="text-xs text-zinc-500">Fulfill pending orders</div>
            </div>
          </Link>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Multi-Variant Stock</h2>
          <ShopInventoryVariants />
        </div>

        <ShopInventoryInsightsTab />

      </div>
    </div>
  );
}
