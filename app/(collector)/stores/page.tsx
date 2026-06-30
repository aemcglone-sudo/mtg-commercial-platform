'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Store {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  websiteUrl: string;
  inventoryCount: number;
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/marketplace/stores')
      .then(r => r.json())
      .then((d: { stores: Store[] }) => setStores(d.stores ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Nearby Shops</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Local game stores on Grimoire</p>
        </div>

        {loading ? (
          <p className="text-zinc-600 text-sm py-8 text-center">Loading…</p>
        ) : stores.length === 0 ? (
          <p className="text-zinc-600 text-sm py-8 text-center">No shops have joined Grimoire yet.</p>
        ) : (
          <div className="space-y-2">
            {stores.map(s => (
              <Link
                key={s.id}
                href={`/stores/${s.slug}`}
                className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-5 py-4 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-100 group-hover:text-white leading-snug">{s.name}</p>
                    {s.address && <p className="text-sm text-zinc-500 mt-0.5">{s.address}</p>}
                    {s.websiteUrl && (
                      <p className="text-xs text-emerald-500 mt-1 truncate">{s.websiteUrl.replace(/^https?:\/\//, '')}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-600">{s.inventoryCount} singles</p>
                    <p className="text-xs text-zinc-700 mt-0.5 group-hover:text-zinc-500">View →</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
