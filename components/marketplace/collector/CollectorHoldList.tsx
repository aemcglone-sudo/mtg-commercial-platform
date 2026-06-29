'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Hold {
  id: string;
  status: string;
  cardName: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  imageUrl: string;
  shopName: string;
  shopSlug: string;
  pickupWindow: string;
  collectorNote: string;
  shopNote: string;
  pickupExpiresAt: string;
  expiresAt: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  requested:  { label: 'Awaiting Confirmation', color: 'text-yellow-400' },
  confirmed:  { label: 'Confirmed — Ready for Pickup', color: 'text-emerald-400' },
  completed:  { label: 'Completed', color: 'text-zinc-500' },
  declined:   { label: 'Declined', color: 'text-red-400' },
  cancelled:  { label: 'Cancelled', color: 'text-zinc-600' },
  expired:    { label: 'Expired', color: 'text-zinc-600' },
};

export default function CollectorHoldList() {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/marketplace/holds')
      .then(r => r.ok ? r.json() : null)
      .then((data: { holds: Hold[] } | null) => {
        if (data) setHolds(data.holds);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function cancelHold(id: string) {
    if (!confirm('Cancel this hold?')) return;
    setCancelling(id);
    await fetch(`/api/marketplace/holds/${id}/cancel`, { method: 'POST' });
    setHolds(hs => hs.map(h => h.id === id ? { ...h, status: 'cancelled' } : h));
    setCancelling(null);
  }

  const activeStatuses = ['requested', 'confirmed'];
  const displayed = filter === 'active'
    ? holds.filter(h => activeStatuses.includes(h.status))
    : holds;

  function formatExpiry(iso: string) {
    const d = new Date(iso);
    const diff = d.getTime() - Date.now();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 0) return 'Expired';
    if (hrs < 24) return `${hrs}h remaining`;
    return `${Math.floor(hrs / 24)}d remaining`;
  }

  if (loading) return <div className="text-zinc-600 text-sm py-12 text-center">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(['active', 'all'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {f === 'active' ? 'Active' : 'All'}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-zinc-500 text-sm">{filter === 'active' ? 'No active holds.' : 'No holds yet.'}</p>
          <Link href="/marketplace/find" className="text-emerald-400 hover:text-emerald-300 text-sm">Find cards locally →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map(h => {
            const statusInfo = STATUS_LABELS[h.status] ?? { label: h.status, color: 'text-zinc-400' };
            const isActive = activeStatuses.includes(h.status);
            return (
              <div key={h.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-4">
                  {h.imageUrl && <img src={h.imageUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-100">{h.cardName}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{h.condition}{h.foil ? ' · Foil' : ''} · <span className="text-amber-400">${(h.priceCents / 100).toFixed(2)}</span></p>
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">{h.shopName}</p>

                    {h.status === 'confirmed' && h.pickupExpiresAt && (
                      <p className="text-xs text-emerald-300 mt-1">⏱ {formatExpiry(h.pickupExpiresAt)} to pick up</p>
                    )}
                    {h.status === 'requested' && h.expiresAt && (
                      <p className="text-xs text-yellow-500 mt-1">⏱ {formatExpiry(h.expiresAt)} for shop to respond</p>
                    )}

                    {h.shopNote && (
                      <div className="mt-2 bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-400">
                        Shop note: {h.shopNote}
                      </div>
                    )}
                  </div>
                </div>

                {isActive && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => cancelHold(h.id)}
                      disabled={cancelling === h.id}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {cancelling === h.id ? 'Cancelling…' : 'Cancel Hold'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
