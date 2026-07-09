'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import HoldRequestModal from './HoldRequestModal';
import CardDetailModal from '@/components/CardDetailModal';

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
  id: string;
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

const CATEGORY_LABELS: Record<string, string> = {
  booster_box: 'Booster Box', collector_box: 'Collector Box', bundle: 'Bundle',
  commander_precon: 'Commander Precon', prerelease_kit: 'Prerelease Kit',
  starter_deck: 'Starter Deck', sleeve: 'Sleeves', deck_box: 'Deck Box',
  playmat: 'Playmat', dice: 'Dice', binder: 'Binder', storage_box: 'Storage',
  other_sealed: 'Sealed', other_accessory: 'Accessory',
};

function CardTile({ item, onView, onHold }: { item: InventoryItem; onView: (name: string) => void; onHold: (item: InventoryItem) => void }) {
  return (
    <div className="group relative text-left space-y-1.5">
      <button type="button" onClick={() => onView(item.cardName)} className="w-full">
        <div className="relative rounded-xl overflow-hidden bg-zinc-800 aspect-[63/88]">
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.cardName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
            : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs p-2 text-center leading-tight">{item.cardName}</div>
          }
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
            <p className="text-xs font-semibold text-amber-400">${(item.priceCents / 100).toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onHold(item); }}
            className="absolute top-1.5 right-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Hold
          </button>
        </div>
      </button>
      <p className="text-[11px] text-zinc-400 leading-tight truncate px-0.5">{item.cardName}</p>
      <p className={`text-[10px] px-0.5 ${CONDITION_COLOR[item.condition] ?? 'text-zinc-500'}`}>{item.condition}{item.foil ? ' · Foil' : ''}</p>
    </div>
  );
}

export default function StoreProfile({ slug }: { slug: string }) {
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);
  const [holdItem, setHoldItem] = useState<InventoryItem | null>(null);
  const [holdSuccess, setHoldSuccess] = useState('');
  const [favorited, setFavorited] = useState(false);
  const [trendingNames, setTrendingNames] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/marketplace/stores/${slug}/favorite`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { favorited: boolean } | null) => { if (d) setFavorited(d.favorited); })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    fetch(`/api/marketplace/stores/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { shop: Omit<StoreDetail, 'inventory' | 'products'>; inventory: StoreDetail['inventory']; products: StoreDetail['products'] } | null) => {
        if (data?.shop) setStore({ ...data.shop, inventory: data.inventory ?? [], products: data.products ?? [] });
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/trending-cards')
      .then(r => r.ok ? r.json() : { cards: [] })
      .then((d: { cards: { name: string }[] }) => setTrendingNames(d.cards?.map(c => c.name) ?? []))
      .catch(() => {});
  }, [slug]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-zinc-600 text-sm">Loading…</div>;
  if (!store) return <div className="max-w-3xl mx-auto px-4 py-16 text-center"><p className="text-zinc-500">Store not found.</p><Link href="/stores" className="text-emerald-400 text-sm mt-2 block">← Back to stores</Link></div>;

  const displayedCards = [...store.inventory]
    .sort((a, b) => b.priceCents - a.priceCents)
    .filter(i => !search || i.cardName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <Link href="/stores" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← All stores</Link>

      {/* Store header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-100">{store.name}</h1>
          <button
            type="button"
            onClick={async () => {
              const method = favorited ? 'DELETE' : 'POST';
              await fetch(`/api/marketplace/stores/${slug}/favorite`, { method });
              setFavorited(!favorited);
            }}
            className={`shrink-0 text-2xl transition-colors ${favorited ? 'text-red-400' : 'text-zinc-600 hover:text-red-400'}`}
            title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            {favorited ? '♥' : '♡'}
          </button>
        </div>
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

      {store.lat && store.lng && (
        <MapView
          pins={[{ lat: store.lat, lng: store.lng, label: store.name, popup: `<strong>${store.name}</strong><br/>${store.address}` }]}
          className="h-44"
          zoom={15}
        />
      )}

      {holdSuccess && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3 text-sm text-emerald-300">✅ {holdSuccess}</div>
      )}

      {/* Products */}
      {store.products.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Products</h2>
          <div className="space-y-2">
            {store.products.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt="" className="w-10 h-10 object-contain rounded shrink-0" />
                  : <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-lg shrink-0">📦</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 leading-snug truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500">{CATEGORY_LABELS[p.category] ?? p.category} · Qty {p.quantity}</p>
                  {p.notes && <p className="text-xs text-zinc-600 truncate">{p.notes}</p>}
                </div>
                <p className="text-amber-400 font-semibold text-sm shrink-0">${(p.priceCents / 100).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Singles grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Singles <span className="text-zinc-600 font-normal normal-case">({store.inventory.length})</span>
          </h2>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search singles…"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 w-44"
          />
        </div>

        {/* Featured: trending cards this shop has in stock */}
        {!search && store.inventory.length > 0 && (() => {
          const inventoryByName = new Map<string, InventoryItem>();
          for (const item of store.inventory) {
            const existing = inventoryByName.get(item.cardName);
            if (!existing || item.priceCents > existing.priceCents) inventoryByName.set(item.cardName, item);
          }
          // Show top 8 trending cards; mark whether shop has them in stock
          const featured = trendingNames.slice(0, 8).map(name => ({
            name,
            item: inventoryByName.get(name) ?? null,
          }));
          if (featured.length === 0) return null;
          return (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Trending in the community</p>
              <div className="grid grid-cols-4 gap-3 pb-4 border-b border-zinc-800">
                {featured.map(({ name, item }) => item
                  ? <CardTile key={item.id + 'featured'} item={item} onView={setSelectedCardName} onHold={setHoldItem} />
                  : (
                    <button key={name + 'trending'} type="button" onClick={() => setSelectedCardName(name)} className="group text-left space-y-1.5 opacity-50">
                      <div className="relative rounded-xl overflow-hidden bg-zinc-800 aspect-[63/88] flex items-center justify-center p-2">
                        <p className="text-zinc-500 text-[10px] text-center leading-tight">{name}</p>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                          <p className="text-[10px] text-zinc-500">Not in stock</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-tight truncate px-0.5">{name}</p>
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })()}

        {displayedCards.length === 0
          ? <p className="text-zinc-600 text-sm py-6 text-center">{search ? 'No results' : 'No singles listed yet'}</p>
          : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {displayedCards.map(item => (
                <CardTile key={item.id + item.condition} item={item} onView={setSelectedCardName} onHold={setHoldItem} />
              ))}
            </div>
          )
        }
      </section>

      {selectedCardName && (
        <CardDetailModal
          cardName={selectedCardName}
          onClose={() => setSelectedCardName(null)}
        />
      )}

      {holdItem && (
        <HoldRequestModal
          item={{
            inventoryId: holdItem.id,
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
