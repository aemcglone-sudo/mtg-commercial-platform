'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import OrderDetailModal from '@/components/OrderDetailModal';

type Status = 'all' | 'pending' | 'paid' | 'fulfilled' | 'cancelled';
const STATUSES: Status[] = ['all', 'pending', 'paid', 'fulfilled', 'cancelled'];

interface Order {
  id: string;
  status: string;
  totalCents: number;
  fulfillmentType: string | null;
  createdAt: string;
  itemCount: number;
  buyerUsername: string;
  buyerEmail: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  paid: 'bg-blue-900/50 text-blue-300 border-blue-700',
  fulfilled: 'bg-green-900/50 text-green-300 border-green-700',
  cancelled: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

function OrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawStatus = (searchParams.get('status') ?? 'all') as Status;
  const activeStatus: Status = STATUSES.includes(rawStatus) ? rawStatus : 'all';

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const load = useCallback(async (p = 1, status = activeStatus) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), status });
      const res = await fetch(`/api/shops/orders?${qs}`);
      if (!res.ok) return;
      const data = await res.json() as { orders: Order[]; total: number; pages: number };
      setOrders(data.orders);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => { load(1, activeStatus); }, [activeStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = useCallback((s: Status) => {
    router.push(`/shop/orders?status=${s}`);
  }, [router]);

  function handleStatusChange(id: string, status: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Orders</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{total.toLocaleString()} order{total !== 1 ? 's' : ''}</p>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 bg-zinc-900/50 rounded-xl p-1 border border-zinc-800 w-fit">
          {STATUSES.map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${activeStatus === s ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {s}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-zinc-600 text-sm">Loading…</div>
        )}

        {!loading && orders.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-zinc-400">No orders{activeStatus !== 'all' ? ` with status "${activeStatus}"` : ''}</p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 uppercase tracking-wide">Order</th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 uppercase tracking-wide">Buyer</th>
                  <th className="px-4 py-3 text-center text-xs text-zinc-500 uppercase tracking-wide hidden sm:table-cell">Cards</th>
                  <th className="px-4 py-3 text-right text-xs text-zinc-500 uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-center text-xs text-zinc-500 uppercase tracking-wide hidden md:table-cell">Fulfillment</th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-center text-xs text-zinc-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs text-zinc-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">#{order.id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-200 font-medium">{order.buyerUsername}</div>
                      <div className="text-zinc-600 text-xs">{order.buyerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-400 hidden sm:table-cell">{order.itemCount}</td>
                    <td className="px-4 py-3 text-right text-zinc-200 font-medium">{fmt(order.totalCents)}</td>
                    <td className="px-4 py-3 text-center text-zinc-500 text-xs hidden md:table-cell capitalize">{order.fulfillmentType ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[order.status] ?? STATUS_BADGE.pending}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setViewingId(order.id)}
                          className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors">
                          View
                        </button>
                        {order.status === 'paid' && (
                          <button type="button"
                            onClick={async () => {
                              await fetch(`/api/shops/orders/${order.id}`, {
                                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'fulfilled' }),
                              });
                              handleStatusChange(order.id, 'fulfilled');
                            }}
                            className="px-3 py-1 text-xs rounded-lg border border-green-700 text-green-400 hover:bg-green-900/30 transition-colors">
                            Fulfill
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button type="button" disabled={page === 1} onClick={() => load(page - 1)}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">
              ← Prev
            </button>
            <span className="text-xs text-zinc-500">{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => load(page + 1)}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">
              Next →
            </button>
          </div>
        )}
      </div>

      {viewingId && (
        <OrderDetailModal
          orderId={viewingId}
          onClose={() => setViewingId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense><OrdersContent /></Suspense>;
}
