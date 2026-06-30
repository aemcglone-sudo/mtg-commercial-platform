'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import HoldRequestModal from './HoldRequestModal';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  websiteUrl: string;
  hours: string;
  specialties: string[];
  holdInstructions: string;
  lat: number | null;
  lng: number | null;
  inventory: InventoryItem[];
  products: ProductItem[];
}

interface InventoryItem {
  scryfallId: string;
  cardName: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  quantity: number;
  imageUrl: string;
}

interface ProductItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  priceCents: number;
  quantity: number;
  fulfillmentType: string;
  notes: string | null;
}

const CONDITION_COLOR: Record<string, string> = {
  NM: 'text-emerald-400', LP: 'text-green-400', MP: 'text-yellow-400', HP: 'text-orange-400', DMG: 'text-red-400',
};

const FULFILLMENT_LABEL: Record<string, string> = {
  pickup: 'In-store pickup', ship: 'Ships', both: 'Pickup or ship',
};

const CATEGORY_LABELS: Record<string, string> = {
  booster_box: 'Booster Box', collector_box: 'Collector Box', bundle: 'Bundle',
  commander_precon: 'Commander Precon', prerelease_kit: 'Prerelease Kit',
  starter_deck: 'Starter Deck', sleeve: 'Sleeves', deck_box: 'Deck Box',
  playmat: 'Playmat', dice: 'Dice', binder: 'Binder', storage_box: 'Storage',
  other_sealed: 'Sealed', other_accessory: 'Accessory',
};

export default function StoreProfile({ slug }: { slug: string }) {
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'cards' | 'products'>('cards');
  const [holdItem, setHoldItem] = useState<InventoryItem | null>(null);
  const [holdSuccess, setHoldSuccess] = useState('');

  useEffect(() => {
    fetch(`/api/marketplace/stores/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { shop: Omit<StoreDetail, 'inventory' | 'products'>; inventory: StoreDetail['inventory']; products: StoreDetail['products'] } | null) => {
        if (data?.shop) setStore({ ...data.shop, inventory: data.inventory ?? [], products: data.products ?? [] });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-zinc-600 text-sm">Loading…</div>;
  if (!store) return <div className="max-w-2xl mx-auto px-4 py-16 text-center"><p className="text-zinc-500">Store not found.</p><Link href="/stores" className="text-emerald-400 text-sm mt-2 block">← Back to stores</Link></div>;

  const filteredCards = store.inventory.filter(i =>
    !search || i.cardName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProducts = store.products?.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <Link href="/stores" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← All stores</Link>

      {/* Store header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">{store.name}</h1>
        {store.address && <p className="text-zinc-500 text-sm">{store.address}</p>}
        <div className="flex gap-4 text-xs text-zinc-600">
          {store.phone && <span>📞 {store.phone}</span>}
          {store.websiteUrl && <a href={store.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">🌐 Website</a>}
        </div>
        {store.hours && <p className="text-xs text-zinc-600">⏰ {store.hours}</p>}
        {store.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {store.specialties.map(s => <span key={s} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{s}</span>)}
          </div>
        )}
      </div>

      {/* Map */}
      {store.lat && store.lng && (
        <MapView
          pins={[{ lat: store.lat, lng: store.lng, label: store.name, popup: `<strong>${store.name}</strong><br/>${store.address}` }]}
          className="h-56"
          zoom={15}
        />
      )}

      {holdSuccess && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3 text-sm text-emerald-300">✅ {holdSuccess}</div>
      )}

      {/* Tabs + search */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 border-b border-zinc-800 flex-1">
            <button
              type="button"
              onClick={() => { setTab('cards'); setSearch(''); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'cards' ? 'border-emerald-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              Singles <span className="text-zinc-600 font-normal">({store.inventory.length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setTab('products'); setSearch(''); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'products' ? 'border-emerald-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              Products <span className="text-zinc-600 font-normal">({store.products?.length ?? 0})</span>
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'cards' ? 'Search singles…' : 'Search products…'}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 w-40"
          />
        </div>

        {/* Cards tab */}
        {tab === 'cards' && (
          filteredCards.length === 0
            ? <p className="text-zinc-600 text-sm py-6 text-center">{search ? 'No results' : 'No singles listed yet'}</p>
            : <div className="space-y-2">
                {filteredCards.map(item => (
                  <div key={item.scryfallId + item.condition} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
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

        {/* Products tab */}
        {tab === 'products' && (
          filteredProducts.length === 0
            ? <p className="text-zinc-600 text-sm py-6 text-center">{search ? 'No results' : 'No products listed yet'}</p>
            : <div className="space-y-2">
                {filteredProducts.map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt="" className="w-10 h-10 object-contain rounded shrink-0" />
                      : <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-lg shrink-0">📦</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100 leading-snug truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500">{CATEGORY_LABELS[p.category] ?? p.category} · {FULFILLMENT_LABEL[p.fulfillmentType] ?? p.fulfillmentType} · Qty {p.quantity}</p>
                      {p.notes && <p className="text-xs text-zinc-600 truncate">{p.notes}</p>}
                    </div>
                    <p className="text-amber-400 font-semibold text-sm shrink-0">${(p.priceCents / 100).toFixed(2)}</p>
                  </div>
                ))}
              </div>
        )}
      </div>

      {holdItem && (
        <HoldRequestModal
          item={{
            inventoryId: holdItem.scryfallId,
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
