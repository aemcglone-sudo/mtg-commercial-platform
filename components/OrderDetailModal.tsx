'use client';

import { useState, useEffect, useCallback } from 'react';
import { CardNameLink } from '@/components/CardNameLink';

interface OrderItem {
  id: string;
  cardName: string;
  quantity: number;
  priceCents: number;
  inventoryId: string | null;
}

interface Order {
  id: string;
  status: string;
  subtotalCents: number;
  platformFeeCents: number;
  totalCents: number;
  fulfillmentType: string | null;
  notes: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  buyerUsername: string;
  buyerEmail: string;
}

interface Props {
  orderId: string;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  paid: 'bg-blue-900/50 text-blue-300 border-blue-700',
  fulfilled: 'bg-green-900/50 text-green-300 border-green-700',
  cancelled: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

export default function OrderDetailModal({ orderId, onClose, onStatusChange }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/shops/orders/${orderId}`)
      .then(r => r.json())
      .then((d: { order: Order; items: OrderItem[] }) => { setOrder(d.order); setItems(d.items); })
      .finally(() => setLoading(false));
  }, [orderId]);

  const updateStatus = useCallback(async (status: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      await fetch(`/api/shops/orders/${orderId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setOrder(prev => prev ? { ...prev, status } : prev);
      onStatusChange(orderId, status);
    } finally {
      setUpdating(false);
    }
  }, [order, orderId, onStatusChange]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold">Order #{orderId.slice(-8).toUpperCase()}</h2>
            {order && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[order.status] ?? STATUS_BADGE.pending}`}>
                {order.status}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors text-xl leading-none">×</button>
        </div>

        {loading && (
          <div className="p-8 text-center text-zinc-500 text-sm">Loading…</div>
        )}

        {!loading && order && (
          <div className="p-6 space-y-6">
            {/* Buyer */}
            <div className="flex items-start gap-6">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Buyer</p>
                <p className="text-zinc-200 font-medium">{order.buyerUsername}</p>
                <p className="text-zinc-500 text-sm">{order.buyerEmail}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Fulfillment</p>
                <p className="text-zinc-200 capitalize">{order.fulfillmentType ?? 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Date</p>
                <p className="text-zinc-400 text-sm">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {order.notes && (
              <div className="p-3 bg-zinc-900 rounded-xl text-sm text-zinc-400 border border-zinc-800">
                <span className="text-zinc-500">Notes: </span>{order.notes}
              </div>
            )}

            {/* Line items */}
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Items</p>
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs text-zinc-500 uppercase">Card</th>
                      <th className="px-4 py-2.5 text-center text-xs text-zinc-500 uppercase">Qty</th>
                      <th className="px-4 py-2.5 text-right text-xs text-zinc-500 uppercase">Price</th>
                      <th className="px-4 py-2.5 text-right text-xs text-zinc-500 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-zinc-900/50">
                        <td className="px-4 py-3 text-zinc-200"><CardNameLink name={item.cardName} /></td>
                        <td className="px-4 py-3 text-center text-zinc-400">×{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-zinc-400">{fmt(item.priceCents)}</td>
                        <td className="px-4 py-3 text-right text-zinc-300">{fmt(item.priceCents * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span><span>{fmt(order.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Platform fee</span><span>{fmt(order.platformFeeCents)}</span>
              </div>
              <div className="flex justify-between font-semibold text-zinc-200 border-t border-zinc-800 pt-1.5">
                <span>Total</span><span>{fmt(order.totalCents)}</span>
              </div>
            </div>

            {order.stripePaymentIntentId && (
              <a
                href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                View in Stripe →
              </a>
            )}

            {/* Status actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
              {order.status !== 'paid' && order.status !== 'fulfilled' && order.status !== 'cancelled' && (
                <button type="button" disabled={updating} onClick={() => updateStatus('paid')}
                  className="px-4 py-2 text-sm rounded-xl bg-blue-900/40 border border-blue-700 text-blue-300 hover:bg-blue-900/60 disabled:opacity-50 transition-colors">
                  Mark Paid
                </button>
              )}
              {order.status !== 'fulfilled' && order.status !== 'cancelled' && (
                <button type="button" disabled={updating} onClick={() => updateStatus('fulfilled')}
                  className="px-4 py-2 text-sm rounded-xl bg-green-900/40 border border-green-700 text-green-300 hover:bg-green-900/60 disabled:opacity-50 transition-colors">
                  Mark Fulfilled
                </button>
              )}
              {order.status !== 'cancelled' && (
                <button type="button" disabled={updating} onClick={() => updateStatus('cancelled')}
                  className="px-4 py-2 text-sm rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 disabled:opacity-50 transition-colors">
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
