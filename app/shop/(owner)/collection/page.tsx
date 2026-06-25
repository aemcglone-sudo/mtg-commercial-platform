'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CollectionBrowser from '@/components/CollectionBrowser';
import CollectionInsightsTab from '@/components/CollectionInsightsTab';
import CollectionChatTab from '@/components/CollectionChatTab';
import CardDetailModal from '@/components/CardDetailModal';
import type { CollectionResult } from '@/app/(collector)/page';
import type { CollectionCardData } from '@/components/CollectionBrowser';

type Tab = 'inventory' | 'insights' | 'chat';
const VALID_TABS: Tab[] = ['inventory', 'insights', 'chat'];

async function fetchShopCollection(): Promise<CollectionResult | null> {
  const allCards: CollectionCardData[] = [];
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const res = await fetch(`/api/shops/inventory?page=${page}&limit=200`);
    if (!res.ok) return null;
    const data = await res.json() as {
      items: Array<{ cardName: string; quantity: number; priceCents: number; imageUrl: string | null; scryfallId: string; setCode: string }>;
      total: number; pages: number;
    };
    pages = data.pages ?? 1;
    for (const item of data.items) {
      const existing = allCards.find(c => c.name === item.cardName);
      if (existing) { existing.quantity += item.quantity; continue; }
      allCards.push({
        name: item.cardName,
        quantity: item.quantity,
        priceUsd: item.priceCents ? item.priceCents / 100 : null,
        imageUrl: item.imageUrl,
        scryfallUri: item.scryfallId ? `https://scryfall.com/card/${item.scryfallId}` : null,
        setName: item.setCode ?? null,
        typeLine: null, colors: [], cmc: null, rarity: null,
        collectionType: 'paper',
      });
    }
    page++;
  }

  if (allCards.length === 0) return null;
  return {
    collectionSize: allCards.length,
    totalCards: allCards.reduce((s, c) => s + c.quantity, 0),
    detectedFormat: 'Shop Inventory',
    collectionCards: allCards,
  };
}

function ShopCollectionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'inventory';

  const [collection, setCollection] = useState<CollectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  useEffect(() => {
    fetchShopCollection().then(setCollection).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      setSelectedCard((e as CustomEvent<string>).detail);
    }
    window.addEventListener('card-detail-open', handler);
    return () => window.removeEventListener('card-detail-open', handler);
  }, []);

  const setTab = useCallback((t: Tab) => router.push(`/shop/collection?tab=${t}`), [router]);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">
            {activeTab === 'inventory' ? 'Inventory' : activeTab === 'insights' ? 'Insights' : 'Ask Khoa'}
          </h1>
          {collection && (
            <p className="text-zinc-500 text-sm mt-0.5">
              {collection.collectionSize.toLocaleString()} unique cards · {collection.totalCards.toLocaleString()} total
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-zinc-600 text-sm">Loading inventory…</div>
        )}

        {!loading && !collection && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center space-y-3">
            <p className="text-zinc-400">Your inventory is empty.</p>
            <a href="/shop/settings?tab=inventory" className="text-amber-400 text-sm hover:text-amber-300 transition-colors">
              Upload inventory in Settings →
            </a>
          </div>
        )}

        {!loading && collection && (
          <>
            {activeTab === 'inventory' && (
              <CollectionBrowser
                cards={collection.collectionCards}
                totalCards={collection.totalCards}
                detectedFormat={collection.detectedFormat}
              />
            )}
            {activeTab === 'insights' && (
              <CollectionInsightsTab cards={collection.collectionCards} />
            )}
            {activeTab === 'chat' && (
              <CollectionChatTab
                collection={collection}
                prefillMessage={chatMessage}
                onMessageSent={() => setChatMessage('')}
              />
            )}
          </>
        )}
      </div>

      {selectedCard && (
        <CardDetailModal
          cardName={selectedCard}
          collectionCard={collection?.collectionCards.find(c => c.name === selectedCard) ?? null}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}

export default function ShopCollectionPage() {
  return <Suspense><ShopCollectionContent /></Suspense>;
}
