'use client';

import { useState, useEffect } from 'react';

interface Stats {
  totalRequested: number;
  confirmedRate: number;
  completedRate: number;
  avgResponseTimeMinutes: number | null;
  revenueFromHoldsCents: number;
}

export default function ShopHoldStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/marketplace/shop/holds/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => setStats(data))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Requests', value: stats.totalRequested.toString() },
        { label: 'Confirm Rate', value: `${stats.confirmedRate}%` },
        { label: 'Pickup Rate', value: `${stats.completedRate}%` },
        { label: 'Revenue via Holds', value: `$${(stats.revenueFromHoldsCents / 100).toFixed(0)}` },
      ].map(s => (
        <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500">{s.label}</p>
          <p className="text-xl font-bold text-zinc-100 mt-1">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
