'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PriceDisplay from '@/components/products/PriceDisplay';

interface Product {
  id: string;
  name: string;
  category: string;
  product_type: string;
  set_code: string | null;
  set_name: string | null;
  release_date: string | null;
  msrp_cents: number | null;
  image_url: string | null;
  description: string | null;
  tcgplayer_product_id: string | null;
}

interface ShopListing {
  shopId: string;
  shopName: string;
  shopSlug: string;
  distanceMiles: number;
  priceCents: number;
  quantity: number;
  fulfillmentType: string;
  notes: string | null;
  listingId: string;
}

interface RequestModalProps {
  product: Product;
  shopId: string;
  shopName: string;
  onClose: () => void;
  onSent: () => void;
}

function RequestModal({ product, shopId, shopName, onClose, onSent }: RequestModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/product-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, shopId, message: message.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to send');
      }
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Request from {shopName}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
        <p className="text-sm text-zinc-400">
          Send a request asking <span className="text-zinc-200">{shopName}</span> if they can get{' '}
          <span className="text-zinc-200">{product.name}</span> in stock.
        </p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Optional message for the shop…"
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [shops, setShops] = useState<ShopListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requestShop, setRequestShop] = useState<{ id: string; name: string } | null>(null);
  const [requestedShops, setRequestedShops] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const productRes = await fetch(`/api/products/${id}`);
        if (!productRes.ok) { setNotFound(true); return; }
        const { product: p } = await productRes.json() as { product: Product };
        setProduct(p);

        // Try to get user location for nearby shops
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async pos => {
              const localRes = await fetch(
                `/api/products/${id}/local?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
              );
              const localData = await localRes.json() as { shops: ShopListing[] };
              setShops(localData.shops ?? []);
            },
            async () => {
              const localRes = await fetch(`/api/products/${id}/local`);
              const localData = await localRes.json() as { shops: ShopListing[] };
              setShops(localData.shops ?? []);
            }
          );
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">Loading…</div>;
  }
  if (notFound || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-zinc-400">Product not found.</p>
        <Link href="/products" className="text-indigo-400 hover:text-indigo-300 text-sm">← Back to Products</Link>
      </div>
    );
  }

  const fulfillmentLabel: Record<string, string> = { pickup: 'Pickup', ship: 'Ship', both: 'Pickup / Ship' };

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link href="/products" className="text-sm text-zinc-500 hover:text-zinc-300">← Products</Link>

        {/* Product header */}
        <div className="flex items-start gap-5">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-24 h-24 object-contain rounded-xl bg-zinc-800" />
          ) : (
            <div className="w-24 h-24 bg-zinc-800 rounded-xl flex items-center justify-center text-4xl">📦</div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-zinc-100 leading-snug">{product.name}</h1>
            {product.set_name && <p className="text-sm text-zinc-500 mt-0.5">{product.set_name}</p>}
            {product.msrp_cents && (
              <p className="text-sm text-zinc-400 mt-1">MSRP: ${(product.msrp_cents / 100).toFixed(2)}</p>
            )}
            {product.description && (
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{product.description}</p>
            )}
          </div>
        </div>

        {/* Nearby shops */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            {shops.length > 0 ? `Available at ${shops.length} nearby shop${shops.length > 1 ? 's' : ''}` : 'Not available locally'}
          </h2>

          {shops.length > 0 ? (
            <div className="space-y-3">
              {shops.map(s => (
                <div key={s.listingId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <Link href={`/stores/${s.shopSlug}`} className="text-sm font-medium text-zinc-100 hover:text-indigo-400">
                      {s.shopName}
                    </Link>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-zinc-500">{s.distanceMiles} mi away</span>
                      <span className="text-xs text-zinc-500">{fulfillmentLabel[s.fulfillmentType] ?? s.fulfillmentType}</span>
                      <span className="text-xs text-zinc-500">Qty: {s.quantity}</span>
                    </div>
                    {s.notes && <p className="text-xs text-zinc-500 mt-1 italic">{s.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <PriceDisplay priceCents={s.priceCents} msrpCents={product.msrp_cents} />
                    <div className="flex items-center gap-2 mt-2 justify-end">
                      <button
                        onClick={() => setRequestShop({ id: s.shopId, name: s.shopName })}
                        disabled={requestedShops.has(s.shopId)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                      >
                        {requestedShops.has(s.shopId) ? 'Requested ✓' : 'Request info'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-2">
              <p className="text-sm text-zinc-400">No local shops have this product listed right now.</p>
              <p className="text-xs text-zinc-500">You can request it from a shop you know.</p>
            </div>
          )}
        </div>

        {/* Request from shop section when not nearby */}
        {shops.length === 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Request from a shop</h2>
            <p className="text-sm text-zinc-500">
              Visit <Link href="/stores" className="text-indigo-400 hover:text-indigo-300">Stores</Link> to find
              a local shop and request this product directly.
            </p>
          </div>
        )}
      </div>

      {requestShop && (
        <RequestModal
          product={product}
          shopId={requestShop.id}
          shopName={requestShop.name}
          onClose={() => setRequestShop(null)}
          onSent={() => {
            setRequestedShops(prev => new Set([...prev, requestShop.id]));
            setRequestShop(null);
          }}
        />
      )}
    </div>
  );
}
