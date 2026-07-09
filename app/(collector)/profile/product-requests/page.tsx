'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ProductRequest {
  id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
  shop_id: string;
  shop_name: string;
  message: string | null;
  status: string;
  shop_response: string | null;
  responded_at: string | null;
  expires_at: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-amber-400 bg-amber-900/30',
  available: 'text-green-400 bg-green-900/30',
  declined: 'text-red-400 bg-red-900/30',
  expired: 'text-zinc-400 bg-zinc-800',
};

export default function MyProductRequestsPage() {
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/product-requests')
      .then(r => r.json())
      .then((d: { requests: ProductRequest[] }) => setRequests(d.requests ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">My Product Requests</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Track requests you&apos;ve sent to local shops</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-500 text-sm">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-zinc-400 text-sm">No product requests yet.</p>
            <Link href="/products" className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="w-10 h-10 object-contain rounded bg-zinc-800" />
                  ) : (
                    <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center text-zinc-600">📦</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/products/${r.product_id}`} className="text-sm font-medium text-zinc-100 hover:text-indigo-400">
                        {r.product_name}
                      </Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">at {r.shop_name}</p>
                    {r.message && (
                      <p className="text-sm text-zinc-400 mt-1 italic">&ldquo;{r.message}&rdquo;</p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-600 shrink-0">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>

                {r.shop_response && (
                  <div className="bg-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-zinc-400 mb-0.5">Shop response:</p>
                    <p className="text-sm text-zinc-300">{r.shop_response}</p>
                  </div>
                )}

                {r.status === 'available' && (
                  <div className="pt-1 border-t border-zinc-800">
                    <Link
                      href="/marketplace/find"
                      className="inline-block px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Find This Card →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
