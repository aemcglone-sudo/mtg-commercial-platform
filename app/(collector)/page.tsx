'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import CollectionBrowser, { type CollectionCardData } from '@/components/CollectionBrowser';
import DeckFinderTab from '@/components/DeckFinderTab';
import CollectionChatTab from '@/components/CollectionChatTab';
import MyDecksTab from '@/components/MyDecksTab';
import { CopilotSidebar } from '@/components/CopilotSidebar';
import CardDetailModal from '@/components/CardDetailModal';
import CollectionInsightsTab from '@/components/CollectionInsightsTab';
import MTGNewsTab from '@/components/MTGNewsTab';
import type { MatchedDeck } from '@/lib/deck-matcher';
import type { DeckSummary } from '@/components/CardDetailModal';

type DeckWithoutCards = Omit<MatchedDeck, 'cards'>;
type PortalTab = 'collection' | 'insights' | 'decks' | 'chat' | 'mydecks' | 'news';
const VALID_TABS: PortalTab[] = ['collection', 'insights', 'decks', 'chat', 'mydecks', 'news'];

export interface CollectionResult {
  collectionSize: number;
  totalCards: number;
  detectedFormat: string;
  collectionCards: CollectionCardData[];
}

export interface DeckResult {
  buildable: DeckWithoutCards[];
  aspirational: DeckWithoutCards[];
  suggested?: DeckWithoutCards[];
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab') as PortalTab | null;
  const activeTab: PortalTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'collection';
  const [collection, setCollection] = useState<CollectionResult | null>(null);
  const [collectionText, setCollectionText] = useState('');
  const [decks, setDecks] = useState<DeckResult | null>(null);
  const [userDecks, setUserDecks] = useState<DeckSummary[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'unhealthy' | 'checking'>('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setHealthStatus(res.ok ? 'healthy' : 'unhealthy');
      } catch {
        setHealthStatus('unhealthy');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: collectionText,
          cards: collection?.collectionCards.map((c) => ({ name: c.name, quantity: c.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
      setDecks(data);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAnalyzing(false);
    }
  }, [collection, collectionText]);

  // Load saved collection on mount
  useEffect(() => {
    fetch('/api/collection/saved')
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setCollection(data);
          if (data.rawText) setCollectionText(data.rawText);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load user decks
  useEffect(() => {
    fetch('/api/decks')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUserDecks(data.map((d: any) => ({ id: d.id, name: d.name })));
        }
      })
      .catch(() => {});
  }, []);

  function handleAskAboutCard(cardName: string, question: string) {
    setChatMessage(question);
    router.push('/?tab=chat');
  }

  useEffect(() => {
    function handleKhoaPrompt(e: Event) {
      const prompt = (e as CustomEvent<string>).detail;
      setChatMessage(prompt);
      router.push('/?tab=chat');
    }
    window.addEventListener('khoa-prompt', handleKhoaPrompt);
    return () => window.removeEventListener('khoa-prompt', handleKhoaPrompt);
  }, [router]);

  // Auto-analyze decks when collection loads
  useEffect(() => {
    if (collection && !decks && !analyzing) {
      handleAnalyze();
    }
  }, [collection, decks, analyzing, handleAnalyze]);


  function handleCardClick(cardName: string) {
    setSelectedCard(cardName);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 transition-all duration-300 ${copilotOpen ? 'hidden sm:block sm:mr-96' : ''}`}>

        {/* Loading saved collection */}
        {loading && (
          <div className="text-center py-32 text-zinc-600 text-sm">Loading your collection…</div>
        )}

        {/* Portal tabs - always show, even without collection */}
        {!loading && (
          <>
            {/* No collection yet - only on collection tab */}
            {!collection && activeTab === 'collection' && (
              <div className="text-center py-24 space-y-6">
                <div className="text-6xl">🃏</div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">No collection yet</h2>
                  <p className="text-zinc-500 max-w-sm mx-auto">
                    Upload your Magic collection in Settings to start browsing, finding decks, and chatting with your cards.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
                >
                  ⚙️ Go to Settings
                </Link>
              </div>
            )}

            {activeTab === 'collection' && collection && (
              <CollectionBrowser
                cards={collection.collectionCards}
                totalCards={collection.totalCards}
                detectedFormat={collection.detectedFormat}
                decks={userDecks}
                onCollectionChange={(updated) =>
                  setCollection((prev) => prev ? { ...prev, ...updated } : prev)
                }
                onAskAboutCard={handleAskAboutCard}
              />
            )}
            {activeTab === 'insights' && collection && (
              <CollectionInsightsTab cards={collection.collectionCards} />
            )}
            {activeTab === 'insights' && !collection && (
              <div className="text-center py-24 space-y-6">
                <div className="text-6xl">📊</div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Upload a collection first</h2>
                  <p className="text-zinc-500 max-w-sm mx-auto">
                    View price trends, collection value, and insights about your Magic collection.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
                >
                  ⚙️ Go to Settings
                </Link>
              </div>
            )}
            {activeTab === 'mydecks' && (
              <MyDecksTab collection={collection?.collectionCards || []} />
            )}
            {activeTab === 'decks' && (
              <DeckFinderTab
                decks={decks}
                analyzing={analyzing}
                error={analyzeError}
                onAnalyze={handleAnalyze}
                collection={collection?.collectionCards || []}
              />
            )}
            {activeTab === 'news' && <MTGNewsTab />}
            {activeTab === 'chat' && collection && (
              <CollectionChatTab collection={collection} prefillMessage={chatMessage} onMessageSent={() => setChatMessage('')} />
            )}
            {activeTab === 'chat' && !collection && (
              <div className="text-center py-24 space-y-6">
                <div className="text-6xl">💬</div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Upload a collection first</h2>
                  <p className="text-zinc-500 max-w-sm mx-auto">
                    Khoa needs your collection to provide personalized advice.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
                >
                  ⚙️ Go to Settings
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Copilot Sidebar - hidden on mobile */}
      {collection && (
        <div className="hidden sm:block fixed right-0 top-0 h-screen">
          <CopilotSidebar
            collection={collection}
            isOpen={copilotOpen}
            onToggle={() => setCopilotOpen((v) => !v)}
            currentTab={activeTab}
            onCardClick={handleCardClick}
          />
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          cardName={selectedCard}
          onClose={() => setSelectedCard(null)}
          collectionCard={collection?.collectionCards.find((c) => c.name === selectedCard)}
          decks={userDecks}
          onCollectionChange={() => {
            fetch('/api/collection/saved')
              .then(r => r.json())
              .then(data => { if (data) setCollection(data); })
              .catch(() => {});
          }}
        />
      )}
    </main>
  );
}

export default function Home() {
  return <Suspense><HomeContent /></Suspense>;
}
