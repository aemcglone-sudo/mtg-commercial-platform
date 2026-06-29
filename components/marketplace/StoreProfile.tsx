'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import HoldRequestModal from './HoldRequestModal';

interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  website: string;
  hours: string;
  specialties: string[];
  holdInstructions: string;
  inventory: InventoryItem[];
}

interface InventoryItem {
  inventoryId: string;
  cardName: string;
  scryfallId: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  quantity: number;
  imageUrl: string;
}

const CONDITION_COLOR: Record<string, string> = {
  NM: 'text-emerald-400', LP: 'text-green-400', MP: 'text-yellow-400', HP: 'text-orange-400', DMG: 'text-red-400',
};

export default function StoreProfile({ slug }: { slug: string }) {
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [holdItem, setHoldItem] = useState<InventoryItem | null>(null);
  const [holdSuccess, setHoldSuccess] = useState('');

  useEffect(() => {
    fetch(`/api/marketplace/stores/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: StoreDetail | null) => { setStore(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-zinc-600 text-sm">Loading…</div>;
  if (!store) return <div className="max-w-2xl mx-auto px-4 py-16 text-center"><p className="text-zinc-500">Store not found.</p><Link href="/stores" className="text-emerald-400 text-sm mt-2 block">← Back to stores</Link></div>;

  const filtered = store.inventory.filter(i =>
    !search || i.cardName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <Link href="/stores" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← All stores</Link>

      {/* Store header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">{store.name}</h1>
        {store.address && <p className="text-zinc-500 text-sm">{store.address}</p>}
        <div className="flex gap-4 text-xs text-zinc-600">
          {store.phone && <span>📞 {store.phone}</span>}
          {store.website && <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">🌐 Website</a>}
        </div>
        {store.hours && <p className="text-xs text-zinc-600">⏰ {store.hours}</p>}
        {store.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {store.specialties.map(s => <span key={s} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{s}</span>)}
          </div>
        )}
      </div>

      {holdSuccess && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3 text-sm text-emerald-300">✅ {holdSuccess}</div>
      )}

      {/* Inventory */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-100">Inventory <span className="text-zinc-600 font-normal text-sm">({store.inventory.length})</span></h2>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search inventory…"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-zinc-600 text-sm py-6 text-center">No results</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.inventoryId} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                {item.imageUrl && <img src={item.imageUrl} alt="" className="w-8 h-11 object-cover rounded shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{item.cardName}</p>
                  <p className={`text-xs ${CONDITION_COLOR[item.condition] ?? 'text-zinc-400'}`}>
                    {item.condition}{item.foil ? ' · Foil' : ''} · Qty {item.quantity}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-amber-400 font-semibold text-sm">${(item.priceCents / 100).toFixed(2)}</p>
                  <button
                    type="button"
                    onClick={() => setHoldItem(item)}
                    className="text-xs px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                  >
                    Hold
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {holdItem && (
        <HoldRequestModal
          item={{
            inventoryId: holdItem.inventoryId,
            shopId: store.id,
            shopName: store.name,
            cardName: holdItem.cardName,
            condition: holdItem.condition,
            foil: holdItem.foil,
            priceCents: holdItem.priceCents,
            holdInstructions: store.holdInstructions,
          }}
          onClose={() => setHoldItem(null)}
          onSuccess={() => {
            setHoldItem(null);
            setHoldSuccess(`Hold requested for ${holdItem.cardName}. You'll be notified within 24 hours.`);
          }}
        />
      )}
    </div>
  );
}
