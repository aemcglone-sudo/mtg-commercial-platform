'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AddProductModal from '@/components/products/AddProductModal';

interface Listing {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  product_type: string;
  set_name: string | null;
  msrp_cents: number | null;
  image_url: string | null;
  quantity: number;
  price_cents: string;
  fulfillment_type: string;
  notes: string | null;
  is_active: boolean;
}

interface ProductRequest {
  id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
  collector_email: string;
  message: string | null;
  status: string;
  shop_response: string | null;
  responded_at: string | null;
  created_at: string;
}

type Tab = 'stock' | 'requests';

function fmtPrice(cents: string | number) {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function LowStockBadge({ qty }: { qty: number }) {
  if (qty > 2) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${qty === 0 ? 'bg-red-900/50 text-red-400' : 'bg-amber-900/50 text-amber-400'}`}>
      {qty === 0 ? 'Out of stock' : 'Low stock'}
    </span>
  );
}

function FulfillmentBadge({ type }: { type: string }) {
  const map: Record<string, string> = { pickup: 'Pickup', ship: 'Ship', both: 'Pickup / Ship' };
  return <span className="text-xs text-zinc-500">{map[type] ?? type}</span>;
}

function ShopProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') ?? 'stock') as Tab;

  const [listings, setListings] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const [reqStatusFilter, setReqStatusFilter] = useState<string>('pending');

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shops/products?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { listings: Listing[] };
      setListings(data.listings ?? []);
    } finally {
      setLoading(false);
    }
  }, [q]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shops/product-requests?status=${reqStatusFilter}`);
      const data = await res.json() as { requests: ProductRequest[] };
      setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [reqStatusFilter]);

  useEffect(() => {
    if (tab === 'stock') loadListings();
    else loadRequests();
  }, [tab, loadListings, loadRequests]);

  function setTab(t: Tab) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', t);
    router.push(`/shop/products?${sp.toString()}`);
  }

  function startEdit(l: Listing) {
    setEditId(l.id);
    setEditQty(String(l.quantity));
    setEditPrice((Number(l.price_cents) / 100).toFixed(2));
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/shops/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: parseInt(editQty),
          priceCents: Math.round(parseFloat(editPrice) * 100),
        }),
      });
      setEditId(null);
      await loadListings();
    } finally {
      setSaving(false);
    }
  }

  async function deleteListing(id: string) {
    if (!confirm('Remove this product from your inventory?')) return;
    await fetch(`/api/shops/products/${id}`, { method: 'DELETE' });
    await loadListings();
  }

  async function respondToRequest(id: string, status: 'available' | 'declined', response?: string) {
    await fetch(`/api/product-requests/${id}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, shopResponse: response }),
    });
    await loadRequests();
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Products</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Sealed products & accessories in your store</p>
          </div>
          {tab === 'stock' && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
            >
              + Add Product
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
          {(['stock', 'requests'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t === 'stock' ? 'In Stock' : 'Requests'}
            </button>
          ))}
        </div>

        {tab === 'stock' && (
          <>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />

            {loading ? (
              <div className="text-center py-12 text-zinc-500 text-sm">Loading…</div>
            ) : listings.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-zinc-400 text-sm">No products in your inventory yet.</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Add your first product
                </button>
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900 border-b border-zinc-800">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Product</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-24">Qty</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-28">Price</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-32">Fulfillment</th>
                      <th className="px-4 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {listings.map(l => (
                      <tr key={l.id} className="hover:bg-zinc-900/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {l.image_url ? (
                              <img src={l.image_url} alt="" className="w-8 h-8 object-contain rounded" />
                            ) : (
                              <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center text-zinc-600 text-sm">📦</div>
                            )}
                            <div>
                              <p className="text-zinc-100 font-medium leading-snug">{l.product_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {l.set_name && <span className="text-xs text-zinc-500">{l.set_name}</span>}
                                <LowStockBadge qty={l.quantity} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editId === l.id ? (
                            <input
                              type="number" min="0" value={editQty}
                              onChange={e => setEditQty(e.target.value)}
                              aria-label="Quantity"
                              className="w-16 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 text-right focus:outline-none"
                            />
                          ) : (
                            <span className="text-zinc-200">{l.quantity}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editId === l.id ? (
                            <input
                              type="number" min="0" step="0.01" value={editPrice}
                              onChange={e => setEditPrice(e.target.value)}
                              aria-label="Price"
                              className="w-20 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 text-right focus:outline-none"
                            />
                          ) : (
                            <span className="text-zinc-200">{fmtPrice(l.price_cents)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <FulfillmentBadge type={l.fulfillment_type} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editId === l.id ? (
                              <>
                                <button
                                  onClick={() => saveEdit(l.id)}
                                  disabled={saving}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                                >
                                  {saving ? '…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditId(null)}
                                  className="text-xs text-zinc-500 hover:text-zinc-300"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(l)}
                                  className="text-xs text-zinc-400 hover:text-zinc-200"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteListing(l.id)}
                                  className="text-xs text-red-500 hover:text-red-400"
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'requests' && (
          <>
            <div className="flex gap-2">
              {['pending', 'available', 'declined', 'all'].map(s => (
                <button
                  key={s}
                  onClick={() => setReqStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    reqStatusFilter === s
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-12 text-zinc-500 text-sm">Loading…</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-16 text-zinc-400 text-sm">
                No {reqStatusFilter === 'all' ? '' : reqStatusFilter} product requests.
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map(r => (
                  <ProductRequestCard
                    key={r.id}
                    request={r}
                    onRespond={respondToRequest}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <AddProductModal
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); loadListings(); }}
        />
      )}
    </div>
  );
}

export default function ShopProductsPage() {
  return <Suspense><ShopProductsContent /></Suspense>;
}

function ProductRequestCard({
  request,
  onRespond,
}: {
  request: ProductRequest;
  onRespond: (id: string, status: 'available' | 'declined', response?: string) => Promise<void>;
}) {
  const [responseText, setResponseText] = useState('');
  const [acting, setActing] = useState(false);

  async function act(status: 'available' | 'declined') {
    setActing(true);
    await onRespond(request.id, status, responseText.trim() || undefined);
    setActing(false);
  }

  const statusColors: Record<string, string> = {
    pending: 'text-amber-400 bg-amber-900/30',
    available: 'text-green-400 bg-green-900/30',
    declined: 'text-red-400 bg-red-900/30',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        {request.image_url ? (
          <img src={request.image_url} alt="" className="w-10 h-10 object-contain rounded bg-zinc-800" />
        ) : (
          <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center text-zinc-600">📦</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-zinc-100">{request.product_name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[request.status] ?? 'text-zinc-400'}`}>
              {request.status}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">From: {request.collector_email}</p>
          {request.message && (
            <p className="text-sm text-zinc-400 mt-1 italic">&ldquo;{request.message}&rdquo;</p>
          )}
          {request.shop_response && (
            <p className="text-sm text-zinc-400 mt-1">Your response: {request.shop_response}</p>
          )}
        </div>
        <span className="text-xs text-zinc-600 shrink-0">
          {new Date(request.created_at).toLocaleDateString()}
        </span>
      </div>

      {request.status === 'pending' && (
        <div className="space-y-2 pt-1 border-t border-zinc-800">
          <input
            value={responseText}
            onChange={e => setResponseText(e.target.value)}
            placeholder="Optional response to collector…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => act('available')}
              disabled={acting}
              className="px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              Mark Available
            </button>
            <button
              onClick={() => act('declined')}
              disabled={acting}
              className="px-3 py-1.5 bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-600 disabled:opacity-50 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
