'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ShopInventoryBrowser from '@/components/ShopInventoryBrowser';
import type { ShopItem } from '@/components/ShopInventoryBrowser';
import CollectionChatTab from '@/components/CollectionChatTab';
import CardDetailModal from '@/components/CardDetailModal';
import type { CollectionResult } from '@/app/(collector)/page';
import type { CollectionCardData } from '@/components/CollectionBrowser';

type Tab = 'inventory' | 'chat';
const VALID_TABS: Tab[] = ['inventory', 'chat'];

async function fetchAllInventoryItems(): Promise<ShopItem[]> {
  const all: ShopItem[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const res = await fetch(`/api/shops/inventory?page=${page}&limit=200`);
    if (!res.ok) break;
    const data = await res.json() as { items: ShopItem[]; pages: number };
    all.push(...data.items);
    pages = data.pages ?? 1;
    page++;
  }
  return all;
}

function itemsToCollection(items: ShopItem[]): CollectionResult {
  const cardMap = new Map<string, CollectionCardData>();
  for (const item of items) {
    const ex = cardMap.get(item.cardName);
    if (ex) { ex.quantity += item.quantity; continue; }
    cardMap.set(item.cardName, {
      name: item.cardName,
      quantity: item.quantity,
      priceUsd: item.priceCents ? item.priceCents / 100 : null,
      imageUrl: item.imageUrl,
      scryfallUri: item.scryfallId ? `https://scryfall.com/card/${item.scryfallId}` : null,
      setName: item.setCode ?? null,
      typeLine: item.typeLine ?? null,
      colors: item.colors ? JSON.parse(item.colors) : [],
      cmc: item.cmc ?? null,
      rarity: item.rarity ?? null,
      collectionType: 'paper',
    });
  }
  const collectionCards = [...cardMap.values()];
  return {
    collectionSize: collectionCards.length,
    totalCards: collectionCards.reduce((s, c) => s + c.quantity, 0),
    detectedFormat: 'Shop Inventory',
    collectionCards,
  };
}

function ShopCollectionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'inventory';

  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await fetchAllInventoryItems();
      setItems(loaded);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    function handler(e: Event) {
      setSelectedCard((e as CustomEvent<string>).detail);
    }
    window.addEventListener('card-detail-open', handler);
    return () => window.removeEventListener('card-detail-open', handler);
  }, []);

  const setTab = useCallback((t: Tab) => router.push(`/shop/collection?tab=${t}`), [router]);

  const collection = items.length > 0 ? itemsToCollection(items) : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">
            {activeTab === 'inventory' ? 'Inventory' : 'Ask Khoa'}
          </h1>
          {!loading && collection && (
            <p className="text-zinc-500 text-sm mt-0.5">
              {collection.collectionSize.toLocaleString()} unique cards · {collection.totalCards.toLocaleString()} total
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-zinc-600 text-sm">
            <svg className="w-5 h-5 animate-spin text-amber-400 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
            </svg>
            Loading inventory…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center space-y-3">
            <p className="text-zinc-400">Your inventory is empty.</p>
            <a href="/shop/settings?tab=inventory" className="text-amber-400 text-sm hover:text-amber-300 transition-colors">
              Upload inventory in Settings →
            </a>
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            {activeTab === 'inventory' && (
              <ShopInventoryBrowser items={items} onRefresh={loadItems} />
            )}
            {activeTab === 'chat' && collection && (
              <CollectionChatTab
                collection={collection}
                prefillMessage={chatMessage}
                onMessageSent={() => setChatMessage('')}
              />
            )}
          </>
        )}
      </div>

      {selectedCard && collection && (
        <CardDetailModal
          cardName={selectedCard}
          collectionCard={collection.collectionCards.find(c => c.name === selectedCard) ?? null}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}

export default function ShopCollectionPage() {
  return <Suspense><ShopCollectionContent /></Suspense>;
}
