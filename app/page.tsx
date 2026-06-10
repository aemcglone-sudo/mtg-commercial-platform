'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CollectionBrowser, { type CollectionCardData } from '@/components/CollectionBrowser';
import DeckFinderTab from '@/components/DeckFinderTab';
import MyDecksTab from '@/components/MyDecksTab';
import { CopilotSidebar } from '@/components/CopilotSidebar';
import CardDetailModal from '@/components/CardDetailModal';
import type { MatchedDeck } from '@/lib/deck-matcher';
import type { DeckSummary } from '@/components/CardPreviewModal';

type DeckWithoutCards = Omit<MatchedDeck, 'cards'>;
type PortalTab = 'collection' | 'decks' | 'mydecks';

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

const TABS: { id: PortalTab; label: string; icon: string }[] = [
  { id: 'collection', label: 'My Collection', icon: '🃏' },
  { id: 'mydecks',    label: 'My Decks & Lists', icon: '🎯' },
  { id: 'decks',      label: 'Top Decks',     icon: '⭐' },
];

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PortalTab>('collection');
  const [collection, setCollection] = useState<CollectionResult | null>(null);
  const [collectionText, setCollectionText] = useState('');
  const [decks, setDecks] = useState<DeckResult | null>(null);
  const [userDecks, setUserDecks] = useState<DeckSummary[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Load saved collection and active tab on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab') as PortalTab | null;
    if (savedTab && ['collection', 'decks', 'chat', 'mydecks'].includes(savedTab)) {
      setActiveTab(savedTab);
    }

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

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Close user menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleCardClick(cardName: string) {
    setSelectedCard(cardName);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">

          {/* Brand + collection badge */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-lg sm:text-xl font-black tracking-tight">
              <span className="text-amber-400">MTG</span><span className="hidden sm:inline"> Deck Finder</span>
            </span>
            {collection && (
              <span className="text-xs text-zinc-500 hidden sm:flex items-center gap-1.5">
                {collection.collectionSize.toLocaleString()} cards
                {collection.detectedFormat && collection.detectedFormat !== 'Unknown' && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {collection.detectedFormat}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Copilot toggle + User menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {collection && (
              <button
                type="button"
                onClick={() => setCopilotOpen((v) => !v)}
                className="hidden sm:block p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-amber-400"
                title="Open Shahrazad copilot"
              >
                🧙
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold text-xs">
                  M
                </span>
                <span className="hidden sm:block">MTG</span>
                <span className="text-xs text-zinc-600">{userMenuOpen ? '▲' : '▼'}</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 z-20">
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                  >
                    ⚙️ Settings
                  </Link>
                  <div className="border-t border-zinc-800 my-1" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar — always visible */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
              title={tab.label}
            >
              <span className="text-base sm:text-lg">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
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
              />
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
        />
      )}
    </main>
  );
}
