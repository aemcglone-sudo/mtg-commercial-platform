'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { CollectionCardData } from './CollectionBrowser';
import CardDetailModal from './CardDetailModal';
import BuyOnTCGPlayer from './BuyOnTCGPlayer';

interface Deck {
  id: string;
  name: string;
  format: string;
  strategy: string;
  deckType?: 'paper' | 'arena';
  cards: Record<string, number>;
  commander?: string;
  createdAt: string;
}

interface Props {
  collection: CollectionCardData[];
}

export default function MyDecksTab({ collection }: Props) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  useEffect(() => {
    loadDecks();
  }, []);

  async function loadDecks() {
    try {
      console.log('Loading decks...');
      const res = await fetch('/api/decks');
      console.log('Decks response:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Decks loaded:', data);
        // API returns array directly, not wrapped in object
        const freshDecks = Array.isArray(data) ? data : (data.decks || []);
        setDecks(freshDecks);
        // Keep selectedDeck in sync so edits appear without a page refresh
        setSelectedDeck(prev => prev ? (freshDecks.find((d: Deck) => d.id === prev.id) ?? prev) : null);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch decks:', res.status, errorData);
      }
    } catch (err) {
      console.error('Failed to load decks:', err);
    } finally {
      setLoading(false);
    }
  }

  const collectionMap = new Map(collection.map(c => [c.name, c]));

  if (loading) {
    return (
      <div className="text-center py-32 space-y-4">
        <div className="text-5xl animate-pulse">🃏</div>
        <p className="text-zinc-300">Loading your decks…</p>
      </div>
    );
  }

  if (decks.length === 0 && !showNew) {
    return (
      <div className="text-center space-y-6 py-16">
        <div className="text-5xl" title="My Decks">🃏</div>
        <h2 className="text-2xl font-bold">My Decks</h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          Build and manage your custom Magic decks. Add cards from your collection or import from suggested decks.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => setShowNewList(true)}
            className="px-6 py-3 rounded-xl font-semibold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            + New List
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
          >
            + New Deck
          </button>
        </div>
      </div>
    );
  }

  if (showNew) {
    return (
      <NewDeckForm
        onCancel={() => setShowNew(false)}
        onSave={() => {
          setShowNew(false);
          loadDecks();
        }}
      />
    );
  }

  if (showNewList) {
    return (
      <NewListForm
        onCancel={() => setShowNewList(false)}
        onSave={() => {
          setShowNewList(false);
          loadDecks();
        }}
      />
    );
  }

  if (selectedDeck) {
    return (
      <>
        <DeckDetail
          deck={selectedDeck}
          collection={collectionMap}
          allCollectionCards={collection}
          onBack={() => setSelectedDeck(null)}
          onUpdate={() => loadDecks()}
          onDelete={() => {
            setSelectedDeck(null);
            loadDecks();
          }}
          onCardClick={setSelectedCard}
        />
        {selectedCard && (
          <CardDetailModal
            cardName={selectedCard}
            onClose={() => setSelectedCard(null)}
            collectionCard={collection.find((c) => c.name === selectedCard)}
          />
        )}
      </>
    );
  }

  const deckList = decks.filter(d => d.format !== 'List');
  const listsList = decks.filter(d => d.format === 'List');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">My Decks & Lists ({decks.length})</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewList(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            + New List
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
          >
            + New Deck
          </button>
        </div>
      </div>

      {/* Two column layout: Decks on left, Lists on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Decks Column */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-100">🎯 Decks ({deckList.length})</h3>
          <div className="grid gap-3">
            {deckList.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">No decks yet. Create one to get started!</p>
            ) : (
              deckList.map(deck => {
                const deckCards = Object.entries(deck.cards || {});
                const isArena = deck.deckType === 'arena';
                const relevantCount = deckCards.filter(([name]) => {
                  const card = collectionMap.get(name);
                  if (!card) return false;
                  return isArena
                    ? card.collectionType === 'arena'
                    : (card.collectionType ?? 'paper') === 'paper';
                }).length;
                const coveragePct = deckCards.length > 0 ? (relevantCount / deckCards.length) * 100 : 0;

                return (
                  <div
                    key={deck.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors space-y-3 cursor-pointer"
                    onClick={() => setSelectedDeck(deck)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDeck(deck);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-zinc-100 truncate">{deck.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-zinc-500">{deck.format}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${deck.deckType === 'arena' ? 'bg-purple-900/50 text-purple-300' : 'bg-zinc-800 text-zinc-400'}`}>
                            {deck.deckType === 'arena' ? '⚡ Arena' : '📄 Paper'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${coveragePct >= 90 ? 'text-emerald-400' : coveragePct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                            {coveragePct.toFixed(0)}%
                          </div>
                          <div className="text-xs text-zinc-500">{deckCards.length} total</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${deck.name}"?`)) {
                              fetch(`/api/decks/${deck.id}`, { method: 'DELETE' })
                                .then(() => {
                                  setDecks(d => d.filter(x => x.id !== deck.id));
                                })
                                .catch(err => console.error('Failed to delete deck:', err));
                            }
                          }}
                          className="px-2 py-1 rounded text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-900/50 hover:border-red-800 transition-colors"
                          title="Delete deck"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {deckCards.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">{isArena ? '⚡ Arena owned' : '📄 Paper owned'}</span>
                          <span className={`font-medium ${coveragePct >= 90 ? 'text-emerald-400' : coveragePct >= 70 ? (isArena ? 'text-purple-400' : 'text-amber-400') : 'text-zinc-400'}`}>
                            {relevantCount}/{deckCards.length}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${coveragePct >= 90 ? 'bg-emerald-500' : coveragePct >= 70 ? (isArena ? 'bg-purple-500' : 'bg-amber-500') : 'bg-zinc-600'}`}
                            style={{ width: `${Math.min(coveragePct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lists Column */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-100">📋 Lists ({listsList.length})</h3>
          <div className="grid gap-3">
            {listsList.length === 0 ? (
              <p className="text-sm text-zinc-500 py-2">No lists yet.</p>
            ) : (
              listsList.map(deck => {
          const deckCards = Object.entries(deck.cards || {});
          const isArena = deck.deckType === 'arena';
          const relevantCount = deckCards.filter(([name]) => {
            const card = collectionMap.get(name);
            if (!card) return false;
            return isArena
              ? card.collectionType === 'arena'
              : (card.collectionType ?? 'paper') === 'paper';
          }).length;
          const ownedCount = deckCards.filter(([name]) => collectionMap.has(name)).length;
          const coveragePct = deckCards.length > 0 ? (relevantCount / deckCards.length) * 100 : 0;
          const listOwnedPct = deckCards.length > 0 ? (ownedCount / deckCards.length) * 100 : 0;

          return (
            <div
              key={deck.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors space-y-3"
              onClick={() => setSelectedDeck(deck)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedDeck(deck);
                }
              }}
            >
              <div
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-100 truncate">{deck.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-zinc-500">{deck.format}</p>
                      {deck.format !== 'List' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${deck.deckType === 'arena' ? 'bg-purple-900/50 text-purple-300' : 'bg-zinc-800 text-zinc-400'}`}>
                          {deck.deckType === 'arena' ? '⚡ Arena' : '📄 Paper'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {deck.format !== 'List' && (
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${coveragePct >= 90 ? 'text-emerald-400' : coveragePct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                        {coveragePct.toFixed(0)}%
                      </div>
                      <div className="text-xs text-zinc-500">{deckCards.length} total</div>
                    </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${deck.name}"?`)) {
                          fetch(`/api/decks/${deck.id}`, { method: 'DELETE' })
                            .then(() => loadDecks())
                            .catch(err => console.error('Failed to delete deck:', err));
                        }
                      }}
                      className="px-2 py-1 rounded text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-900/30 border border-red-900/50 hover:border-red-800 transition-colors"
                      title="Delete deck"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {deckCards.length > 0 && deck.format !== 'List' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">{isArena ? '⚡ Arena owned' : '📄 Paper owned'}</span>
                      <span className={`font-medium ${coveragePct >= 90 ? 'text-emerald-400' : coveragePct >= 70 ? (isArena ? 'text-purple-400' : 'text-amber-400') : 'text-zinc-400'}`}>
                        {relevantCount}/{deckCards.length}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${coveragePct >= 90 ? 'bg-emerald-500' : coveragePct >= 70 ? (isArena ? 'bg-purple-500' : 'bg-amber-500') : 'bg-zinc-600'}`}
                        style={{ width: `${Math.min(coveragePct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {deckCards.length > 0 && deck.format === 'List' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Owned</span>
                      <span className={`font-medium ${listOwnedPct >= 90 ? 'text-emerald-400' : listOwnedPct >= 70 ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {ownedCount}/{deckCards.length}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${listOwnedPct >= 90 ? 'bg-emerald-500' : listOwnedPct >= 70 ? 'bg-amber-500' : 'bg-zinc-600'}`}
                        style={{ width: `${Math.min(listOwnedPct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PasteReviewItem {
  inputName: string;
  qty: number;
  canonicalName: string;
  imageUrl: string | null;
  accepted: boolean | null; // null = undecided (treated as accepted)
}
interface PasteReview {
  autoAdded: { name: string; qty: number }[];
  suggestions: PasteReviewItem[];
  notFound: { name: string; qty: number }[];
}

function NewListForm({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  const [name, setName] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string }>>([]);
  const [cards, setCards] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function parseAndImport(text: string) {
    const added: Record<string, number> = {};
    for (const line of text.split('\n')) {
      const trimmed = line.trim().replace(/^[•\-\*]\s*/, '');
      if (!trimmed) continue;
      const match = trimmed.match(/^(\d+)x?\s+(.+)$/);
      if (match) {
        let cardName = match[2].trim().split(' — ')[0].split('(')[0].split('[')[0].trim();
        if (cardName && cardName.length > 1 && !/^\d+$/.test(cardName)) {
          added[cardName] = (added[cardName] || 0) + parseInt(match[1], 10);
        }
      } else if (/^[A-Z]/.test(trimmed) && !trimmed.includes(':')) {
        // bare card name with no quantity — assume 1
        const cardName = trimmed.split(' — ')[0].split('(')[0].split('[')[0].trim();
        if (cardName.length > 1) added[cardName] = (added[cardName] || 0) + 1;
      }
    }
    setCards(prev => {
      const updated = { ...prev };
      for (const [n, q] of Object.entries(added)) updated[n] = (updated[n] || 0) + q;
      return updated;
    });
    setPasteInput('');
  }

  async function handleSearchCards(query: string) {
    setSearchInput(query);
    if (!query.trim()) { setSearchResults([]); return; }
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults((data.data || []).slice(0, 10).map((c: any) => ({ name: c.name })));
      }
    } catch { /* ignore */ }
  }

  async function handleSave() {
    if (!name.trim()) { setError('List name is required'); return; }

    // Auto-import paste textarea if user didn't click "Add to List" manually
    let finalCards = { ...cards };
    if (pasteInput.trim()) {
      for (const line of pasteInput.split('\n')) {
        const trimmed = line.trim().replace(/^[•\-\*]\s*/, '');
        if (!trimmed) continue;
        const match = trimmed.match(/^(\d+)x?\s+(.+)$/);
        if (match) {
          let cardName = match[2].trim().split(' — ')[0].split('(')[0].split('[')[0].trim();
          if (cardName && cardName.length > 1 && !/^\d+$/.test(cardName)) {
            finalCards[cardName] = (finalCards[cardName] || 0) + parseInt(match[1], 10);
          }
        } else if (/^[A-Z]/.test(trimmed) && !trimmed.includes(':')) {
          const cardName = trimmed.split(' — ')[0].split('(')[0].split('[')[0].trim();
          if (cardName.length > 1) finalCards[cardName] = (finalCards[cardName] || 0) + 1;
        }
      }
    }

    if (Object.keys(finalCards).length === 0) { setError('Add at least one card'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), format: 'List', cards: finalCards, isList: true }),
      });
      if (res.ok) { onSave(); } else { setError('Failed to save list'); }
    } catch { setError('Failed to save list'); }
    finally { setSaving(false); }
  }

  const totalCards = Object.values(cards).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="text-zinc-400 hover:text-zinc-200 transition-colors">← Back</button>
        <h2 className="text-xl font-bold text-zinc-100">New List</h2>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Name */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">List Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Cards to Acquire, Trade Binder..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Import by paste */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Import Card List</label>
        <p className="text-xs text-zinc-600 mb-2">Paste any format: <span className="text-zinc-500">1x Lightning Bolt · Lightning Bolt · 4 Counterspell</span></p>
        <textarea
          value={pasteInput}
          onChange={e => setPasteInput(e.target.value)}
          placeholder={"1x Sol Ring\n4x Lightning Bolt\nCounterspell"}
          rows={6}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono text-sm resize-none"
        />
        <button
          type="button"
          onClick={() => parseAndImport(pasteInput)}
          disabled={!pasteInput.trim()}
          className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-colors"
        >
          Add to List
        </button>
      </div>

      {/* Search to add individual cards */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Add Individual Cards</label>
        <input
          type="text"
          value={searchInput}
          onChange={e => handleSearchCards(e.target.value)}
          placeholder="Search for a card..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
        />
        {searchResults.length > 0 && (
          <div className="mt-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
            {searchResults.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  setCards(prev => ({ ...prev, [c.name]: (prev[c.name] || 0) + 1 }));
                  setSearchInput('');
                  setSearchResults([]);
                }}
                className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-zinc-200 border-b border-zinc-700 last:border-b-0 transition-colors"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card preview */}
      {totalCards > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">Cards in List ({totalCards} total, {Object.keys(cards).length} unique)</h3>
            <button type="button" onClick={() => setCards({})} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Clear all</button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {Object.entries(cards).sort(([a], [b]) => a.localeCompare(b)).map(([cardName, qty]) => (
              <div key={cardName} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-zinc-300">{qty}x {cardName}</span>
                <button
                  type="button"
                  onClick={() => setCards(prev => { const u = { ...prev }; delete u[cardName]; return u; })}
                  className="text-zinc-600 hover:text-red-400 px-1 transition-colors"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="px-6 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors">Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim() || totalCards === 0}
          className="flex-1 px-6 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : `Save List (${totalCards} cards)`}
        </button>
      </div>
    </div>
  );
}

function NewDeckForm({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('Commander');
  const [deckType, setDeckType] = useState<'paper' | 'arena'>('paper');
  const [commander, setCommander] = useState('');
  const [commanderResults, setCommanderResults] = useState<Array<{ name: string; imageUrl: string | null }>>([]);
  const [strategy, setStrategy] = useState('');
  const [deckCards, setDeckCards] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; imageUrl: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [showPasteDeckList, setShowPasteDeckList] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [pasteReview, setPasteReview] = useState<PasteReview | null>(null);

  async function handleSearchCards(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards`);
      if (res.ok) {
        const data = await res.json();
        const results = (data.data || []).slice(0, 10).map((card: any) => ({
          name: card.name,
          imageUrl: card.image_uris?.normal || null,
        }));
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Card search error:', err);
    } finally {
      setSearching(false);
    }
  }

  async function handleSearchCommander(query: string) {
    if (!query.trim()) {
      setCommanderResults([]);
      return;
    }
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)} type:legendary type:creature&unique=cards`);
      if (res.ok) {
        const data = await res.json();
        const results = (data.data || []).slice(0, 8).map((card: any) => ({
          name: card.name,
          imageUrl: card.image_uris?.normal || null,
        }));
        setCommanderResults(results);
      }
    } catch (err) {
      console.error('Commander search error:', err);
    }
  }

  function addCard(cardName: string, qty: number = 1) {
    setDeckCards(prev => ({
      ...prev,
      [cardName]: (prev[cardName] || 0) + qty,
    }));
    setSearchInput('');
    setSearchResults([]);
  }

  function removeCard(cardName: string) {
    setDeckCards(prev => {
      const updated = { ...prev };
      delete updated[cardName];
      return updated;
    });
  }

  function updateCardQty(cardName: string, qty: number) {
    if (qty <= 0) {
      removeCard(cardName);
    } else {
      setDeckCards(prev => ({ ...prev, [cardName]: qty }));
    }
  }

  async function handlePasteDeckList() {
    if (!pasteInput.trim()) return;

    const parsed: { name: string; qty: number }[] = [];
    let detectedCommander: string | null = null;
    let inCommanderSection = false;

    const lines = pasteInput.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Track section headers
      if (/^commander:?$/i.test(trimmed)) { inCommanderSection = true; continue; }
      if (/^(deck|sideboard|maindeck|companion):?$/i.test(trimmed)) { inCommanderSection = false; continue; }
      if (/^\/\//.test(trimmed)) continue;

      const match = trimmed.match(/^(\d+)x?\s+(.+)$/i);
      if (match) {
        const qty = parseInt(match[1]);
        // Strip trailing Arena/MTGO set code like "(FDN) 123" or "(BLB)"
        const cardName = match[2]
          .replace(/\s+\([A-Z0-9]{2,6}\)(\s+\d+)?$/, '')
          .trim();
        if (cardName && qty > 0) {
          if (inCommanderSection && qty === 1 && !detectedCommander) {
            detectedCommander = cardName;
          }
          parsed.push({ name: cardName, qty });
        }
      }
    }

    // Auto-fill commander field if detected and not already set
    if (detectedCommander && format === 'Commander' && !commander) {
      setCommander(detectedCommander);
    }
    if (parsed.length === 0) return;

    setValidating(true);
    try {
      // Batch exact-name lookup (Scryfall /cards/collection supports 75 per request)
      const identifiers = parsed.map(c => ({ name: c.name }));
      const collRes = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
      });
      const collData = await collRes.json();

      // Map canonical names from found cards
      const exactFound = new Map<string, string>(); // lowerInputName → canonicalName
      for (const card of (collData.data ?? [])) {
        exactFound.set(card.name.toLowerCase(), card.name);
      }
      const notFoundSet = new Set<string>(
        (collData.not_found ?? []).map((nf: { name?: string }) => (nf.name ?? '').toLowerCase())
      );

      const autoAdded: { name: string; qty: number }[] = [];
      const toFuzzy: { name: string; qty: number }[] = [];

      for (const p of parsed) {
        if (notFoundSet.has(p.name.toLowerCase())) {
          toFuzzy.push(p);
        } else {
          autoAdded.push({ name: exactFound.get(p.name.toLowerCase()) ?? p.name, qty: p.qty });
        }
      }

      // Fuzzy search for each unresolved card
      const suggestions: PasteReviewItem[] = [];
      const notFound: { name: string; qty: number }[] = [];

      for (const card of toFuzzy) {
        try {
          const fuzzyRes = await fetch(
            `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.name)}`
          );
          if (fuzzyRes.ok) {
            const fuzzyCard = await fuzzyRes.json();
            if (fuzzyCard.name.toLowerCase() === card.name.toLowerCase()) {
              // Exact match via fuzzy (batch lookup quirk) — auto-add silently
              autoAdded.push({ name: fuzzyCard.name, qty: card.qty });
            } else {
              const imageUrl =
                fuzzyCard.image_uris?.normal ??
                fuzzyCard.card_faces?.[0]?.image_uris?.normal ??
                null;
              suggestions.push({
                inputName: card.name,
                qty: card.qty,
                canonicalName: fuzzyCard.name,
                imageUrl,
                accepted: null,
              });
            }
          } else {
            notFound.push(card);
          }
        } catch {
          notFound.push(card);
        }
        // Polite pacing for Scryfall
        await new Promise(r => setTimeout(r, 80));
      }

      if (suggestions.length === 0 && notFound.length === 0) {
        // All resolved exactly — add directly
        const cards: Record<string, number> = {};
        for (const c of autoAdded) cards[c.name] = (cards[c.name] || 0) + c.qty;
        setDeckCards(prev => ({ ...prev, ...cards }));
        setPasteInput('');
        setShowPasteDeckList(false);
      } else {
        setPasteReview({ autoAdded, suggestions, notFound });
      }
    } catch {
      // On network failure, fall back to adding names as-is
      const cards: Record<string, number> = {};
      for (const p of parsed) cards[p.name] = (cards[p.name] || 0) + p.qty;
      setDeckCards(prev => ({ ...prev, ...cards }));
      setPasteInput('');
      setShowPasteDeckList(false);
    } finally {
      setValidating(false);
    }
  }

  function confirmPasteReview() {
    if (!pasteReview) return;
    const cards: Record<string, number> = {};
    for (const c of pasteReview.autoAdded) cards[c.name] = (cards[c.name] || 0) + c.qty;
    for (const s of pasteReview.suggestions) {
      if (s.accepted !== false) cards[s.canonicalName] = (cards[s.canonicalName] || 0) + s.qty;
    }
    setDeckCards(prev => ({ ...prev, ...cards }));
    setPasteInput('');
    setPasteReview(null);
    setShowPasteDeckList(false);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const deckData: any = { name, format, strategy, deckType, cards: deckCards };
      if (format === 'Commander') {
        deckData.commander = commander;
      }
      console.log('Creating deck:', deckData);
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deckData),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`✓ Deck "${name}" created!`);
        setTimeout(() => {
          setName('');
          setCommander('');
          setStrategy('');
          setDeckCards({});
          onSave();
        }, 1000);
      } else {
        setError(data.error || 'Failed to create deck');
      }
    } catch (err) {
      console.error('Deck creation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-zinc-100">Create New Deck</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left side: Form */}
        <div className="lg:col-span-2 space-y-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-400">{success}</p>
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Deck Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Grixis Control"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Format</label>
            <select
              value={format}
              onChange={e => {
                setFormat(e.target.value);
                if (e.target.value !== 'Commander') {
                  setCommander('');
                  setCommanderResults([]);
                }
              }}
              title="Select deck format"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              <option>Standard</option>
              <option>Pioneer</option>
              <option>Commander</option>
              <option>Brawl</option>
              <option>Modern</option>
              <option>Legacy</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Deck Type</label>
            <div className="flex bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setDeckType('paper')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${deckType === 'paper' ? 'bg-amber-400 text-black' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                📄 Paper
              </button>
              <button
                type="button"
                onClick={() => setDeckType('arena')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${deckType === 'arena' ? 'bg-purple-500 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                ⚡ Arena
              </button>
            </div>
          </div>

          {format === 'Commander' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Commander *</label>
              <input
                type="text"
                value={commander}
                onChange={e => {
                  setCommander(e.target.value);
                  handleSearchCommander(e.target.value);
                }}
                placeholder="Search legendary creatures..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
              {commanderResults.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg">
                  {commanderResults.map(card => (
                    <button
                      key={card.name}
                      type="button"
                      onClick={() => {
                        setCommander(card.name);
                        setCommanderResults([]);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-zinc-700 transition-colors text-sm text-zinc-200 border-b border-zinc-700 last:border-b-0"
                    >
                      {card.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Strategy (Optional)</label>
            <textarea
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
              placeholder="How do you play this deck? What's the main strategy?"
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Add Cards</label>
            <input
              type="text"
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value);
                handleSearchCards(e.target.value);
              }}
              placeholder="Search for a card..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg">
                {searchResults.map(card => (
                  <button
                    key={card.name}
                    type="button"
                    onClick={() => addCard(card.name)}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700 transition-colors text-sm text-zinc-200 border-b border-zinc-700 last:border-b-0"
                  >
                    {card.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowPasteDeckList(!showPasteDeckList)}
            className="text-xs text-zinc-400 hover:text-amber-400 transition-colors"
          >
            {showPasteDeckList ? '▼ Hide' : '▶ Show'} paste deck list
          </button>

          {showPasteDeckList && (
            <div className="space-y-3">
              {!pasteReview ? (
                <>
                  <textarea
                    value={pasteInput}
                    onChange={e => setPasteInput(e.target.value)}
                    placeholder={`4 Lightning Bolt\n4 Counterspell\n20 Island`}
                    rows={4}
                    disabled={validating}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none font-mono text-sm disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handlePasteDeckList}
                    disabled={validating || !pasteInput.trim()}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded bg-amber-400/20 text-amber-400 hover:bg-amber-400/30 transition-colors disabled:opacity-50"
                  >
                    {validating ? (
                      <>
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Checking cards…
                      </>
                    ) : 'Validate & Import'}
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  {pasteReview.autoAdded.length > 0 && (
                    <p className="text-xs text-green-400">
                      ✓ {pasteReview.autoAdded.length} card{pasteReview.autoAdded.length !== 1 ? 's' : ''} resolved automatically
                    </p>
                  )}

                  {pasteReview.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-amber-400">Did you mean…?</p>
                      {pasteReview.suggestions.map((s, i) => (
                        <div key={i} className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${s.accepted === false ? 'bg-zinc-900 opacity-40' : 'bg-zinc-800'}`}>
                          {s.imageUrl && (
                            <img
                              src={s.imageUrl}
                              alt={s.canonicalName}
                              className="h-10 w-7 object-cover rounded shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            {s.inputName.toLowerCase() !== s.canonicalName.toLowerCase() && (
                              <p className="text-xs text-zinc-500 truncate line-through">{s.inputName}</p>
                            )}
                            <p className="text-sm text-zinc-100 font-medium truncate">{s.canonicalName}</p>
                            <p className="text-xs text-zinc-500">×{s.qty}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPasteReview(prev => prev ? {
                                ...prev,
                                suggestions: prev.suggestions.map((item, idx) =>
                                  idx === i ? { ...item, accepted: true } : item
                                ),
                              } : null)}
                              className={`px-2 py-0.5 text-xs rounded transition-colors ${s.accepted === true ? 'bg-green-500/30 text-green-300 ring-1 ring-green-500' : 'bg-zinc-700 text-zinc-400 hover:bg-green-900/40 hover:text-green-300'}`}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => setPasteReview(prev => prev ? {
                                ...prev,
                                suggestions: prev.suggestions.map((item, idx) =>
                                  idx === i ? { ...item, accepted: false } : item
                                ),
                              } : null)}
                              className={`px-2 py-0.5 text-xs rounded transition-colors ${s.accepted === false ? 'bg-red-500/30 text-red-300 ring-1 ring-red-500' : 'bg-zinc-700 text-zinc-400 hover:bg-red-900/40 hover:text-red-300'}`}
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pasteReview.notFound.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-red-400">Not found on Scryfall:</p>
                      {pasteReview.notFound.map((c, i) => (
                        <p key={i} className="text-xs text-zinc-500 pl-2">✗ {c.name} ×{c.qty}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={confirmPasteReview}
                      className="text-xs px-3 py-1.5 rounded bg-amber-400/20 text-amber-400 hover:bg-amber-400/30 transition-colors"
                    >
                      Add {pasteReview.autoAdded.length + pasteReview.suggestions.filter(s => s.accepted !== false).length} cards to deck
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasteReview(null)}
                      className="text-xs px-3 py-1.5 rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600 transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim() || saving || Object.keys(deckCards).length === 0}
              title={Object.keys(deckCards).length === 0 ? 'Add at least one card' : undefined}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creating…' : `Create Deck (${Object.keys(deckCards).length} unique)`}
            </button>
          </div>
        </div>

        {/* Right side: Cards preview */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-400 mb-4">Cards in Deck ({Object.values(deckCards).reduce((a, b) => a + b, 0)})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.entries(deckCards).length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">No cards added yet</p>
            ) : (
              Object.entries(deckCards)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cardName, qty]) => (
                  <div key={cardName} className="flex items-center gap-2 text-xs">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={qty}
                      onChange={e => updateCardQty(cardName, parseInt(e.target.value) || 0)}
                      title="Card quantity"
                      className="w-10 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-100 text-center"
                    />
                    <span className="flex-1 truncate text-zinc-300">{cardName}</span>
                    <button
                      type="button"
                      onClick={() => removeCard(cardName)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


const COLOR_STYLES: Record<string, string> = {
  W: 'text-yellow-100 bg-zinc-700',
  U: 'text-blue-400 bg-zinc-700',
  B: 'text-zinc-300 bg-zinc-700',
  R: 'text-red-400 bg-zinc-700',
  G: 'text-green-400 bg-zinc-700',
};

function ColorPips({ colors }: { colors?: string[] }) {
  if (!colors || colors.length === 0) return <span className="text-[9px] font-bold px-1 rounded bg-zinc-700 text-zinc-500">C</span>;
  return (
    <span className="inline-flex gap-0.5">
      {colors.map(c => (
        <span key={c} className={`text-[9px] font-bold px-1 rounded ${COLOR_STYLES[c] ?? 'text-zinc-400 bg-zinc-700'}`}>{c}</span>
      ))}
    </span>
  );
}

function DeckDetail({
  deck,
  collection,
  allCollectionCards,
  onBack,
  onUpdate,
  onDelete,
  onCardClick,
}: {
  deck: Deck;
  collection: Map<string, CollectionCardData>;
  allCollectionCards: CollectionCardData[];
  onBack: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onCardClick?: (cardName: string) => void;
}) {
  const [sortColumn, setSortColumn] = useState<'name' | 'qty' | 'price' | 'type' | 'cmc' | 'color'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editCards, setEditCards] = useState<Record<string, number>>({});
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; imageUrl: string | null }>>([]);
  const [saving, setSaving] = useState(false);
  const [scryCardCache, setScryCardCache] = useState<Record<string, any>>({});

  // Build a map of card name to collection types for easy lookup
  const cardCollectionTypes = useMemo(() => {
    const typeMap = new Map<string, Set<string>>();
    allCollectionCards.forEach((card) => {
      const types = typeMap.get(card.name) || new Set<string>();
      types.add(card.collectionType ?? 'paper');
      typeMap.set(card.name, types);
    });
    return typeMap;
  }, [allCollectionCards]);

  // Create case-insensitive collection map for matching
  const collectionLower = new Map(
    Array.from(collection.entries()).map(([name, data]) => [name.toLowerCase(), { name, data }])
  );

  // Normalize common MTG name variants (Worm/Wurm, etc.) for fuzzy ownership matching
  function normalizeCardName(name: string): string {
    return name.toLowerCase().replace(/\bwurm\b/g, 'worm').replace(/\bworm\b/g, 'worm');
  }
  const collectionNormalized = new Map(
    Array.from(collection.entries()).map(([name, data]) => [normalizeCardName(name), { name, data }])
  );

  function isOwned(name: string): boolean {
    return collectionLower.has(name.toLowerCase()) || collectionNormalized.has(normalizeCardName(name));
  }

  const BASIC_LAND_NAMES = new Set([
    'plains', 'island', 'swamp', 'mountain', 'forest', 'wastes',
    'snow-covered plains', 'snow-covered island', 'snow-covered swamp',
    'snow-covered mountain', 'snow-covered forest',
  ]);
  const isBasicLand = (name: string) => BASIC_LAND_NAMES.has(name.toLowerCase());

  // Strip AI-appended annotations like [OWNED], [NEW], (budget) from saved card names
  const deckCards = Object.entries(deck.cards || {}).map(([name, qty]) => {
    const clean = name.replace(/\s*\[.*?\]/g, '').replace(/\s*\(.*?\)/g, '').trim();
    return [clean, qty] as [string, number];
  });
  const ownedCards = deckCards.filter(([name]) => isOwned(name));
  const missingCards = deckCards.filter(([name]) => !isOwned(name));
  const coveragePct = deckCards.length > 0 ? (ownedCards.length / deckCards.length) * 100 : 0;
  const paperOwned = ownedCards.filter(([name]) => (collectionLower.get(name.toLowerCase())?.data?.collectionType ?? 'paper') === 'paper').length;
  const arenaOwned = ownedCards.filter(([name]) => collectionLower.get(name.toLowerCase())?.data?.collectionType === 'arena').length;
  const paperPct = deckCards.length > 0 ? (paperOwned / deckCards.length) * 100 : 0;
  const arenaPct = deckCards.length > 0 ? (arenaOwned / deckCards.length) * 100 : 0;
  const ownedValue = ownedCards.reduce((s, [name, qty]) => {
    if (isBasicLand(name)) return s;
    const match = collectionLower.get(name.toLowerCase());
    const price = match?.data?.priceUsd ?? 0;
    return s + price * qty;
  }, 0);
  const missingValue = missingCards.reduce((s, [name, qty]) => {
    if (isBasicLand(name)) return s;
    const price = allCollectionCards.find(c => c.name.toLowerCase() === name.toLowerCase())?.priceUsd ?? 0;
    return s + price * qty;
  }, 0);
  const totalValue = ownedValue + missingValue;

  // Fetch card data from Scryfall for cards not in collection
  const fetchScryCard = async (name: string) => {
    const key = name.toLowerCase();
    if (scryCardCache[key]) {
      return scryCardCache[key];
    }
    try {
      const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
      if (res.ok) {
        const card = await res.json();
        console.log(`Raw Scryfall response for ${name}:`, { prices: card.prices, usd: card.prices?.usd });
        const cardData = {
          name: card.name,
          priceUsd: card.prices?.usd ? parseFloat(card.prices.usd) : null,
          typeLine: card.type_line || null,
          cmc: card.cmc || null,
          rarity: card.rarity || null,
          colors: card.colors || [],
          set: card.set?.toUpperCase() || null,
          collectorNumber: card.collector_number || null,
        };
        console.log(`Processed ${name}:`, cardData);
        setScryCardCache(prev => ({ ...prev, [key]: cardData }));
        return cardData;
      } else {
        console.error(`Scryfall error for ${name}: ${res.status}`);
      }
    } catch (err) {
      console.error(`Scryfall fetch error for ${name}:`, err);
    }
    return null;
  };

  // Helper function to get card data from any source (owned or unowned)
  const getCardData = (name: string) => {
    // First try the filtered collection (for owned cards)
    const match = collectionLower.get(name.toLowerCase());
    if (match) {
      return match.data;
    }
    // Then try the full collection (for unowned cards)
    const collectionCard = allCollectionCards.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (collectionCard) {
      return collectionCard;
    }
    // Finally try the cache for Scryfall cards
    return scryCardCache[name.toLowerCase()];
  };

  const sortedOwnedCards = useMemo(() => {
    // For lists, show ALL cards; for decks, only show owned cards
    const cardsToSort = deck.format === 'List' ? deckCards : ownedCards;
    const sorted = [...cardsToSort];
    sorted.sort(([nameA, qtyA], [nameB, qtyB]) => {
      const cardA = getCardData(nameA);
      const cardB = getCardData(nameB);
      let compareVal = 0;

      if (sortColumn === 'name') {
        compareVal = nameA.localeCompare(nameB);
      } else if (sortColumn === 'qty') {
        compareVal = qtyA - qtyB;
      } else if (sortColumn === 'price') {
        const priceA = (cardA?.priceUsd ?? 0) * qtyA;
        const priceB = (cardB?.priceUsd ?? 0) * qtyB;
        compareVal = priceA - priceB;
      } else if (sortColumn === 'type') {
        compareVal = (cardA?.typeLine ?? '').localeCompare(cardB?.typeLine ?? '');
      } else if (sortColumn === 'cmc') {
        compareVal = (cardA?.cmc ?? 0) - (cardB?.cmc ?? 0);
      } else if (sortColumn === 'color') {
        compareVal = (cardA?.colors?.join('') ?? '').localeCompare(cardB?.colors?.join('') ?? '');
      }

      return sortDirection === 'asc' ? compareVal : -compareVal;
    });
    return sorted;
  }, [deck.format, deckCards, ownedCards, allCollectionCards, collection, sortColumn, sortDirection]);

  // Fetch Scryfall data for missing cards on mount
  useEffect(() => {
    const fetchMissingCards = async () => {
      for (const [name] of missingCards) {
        if (!scryCardCache[name.toLowerCase()]) {
          await fetchScryCard(name);
        }
      }
    };
    if (missingCards.length > 0) {
      fetchMissingCards();
    }
  }, [missingCards]);

  function handleSort(column: typeof sortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function handleSearchCards(query: string) {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults((data.data || []).slice(0, 10).map((name: string) => ({
            name,
            imageUrl: null,
          })));
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handleEditStart() {
    setEditCards({ ...deck.cards });
    setEditMode(true);
  }

  async function handleSaveEdits() {
    setSaving(true);
    try {
      const res = await fetch(`/api/decks/${deck.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: editCards }),
      });
      if (res.ok) {
        setEditMode(false);
        onUpdate();
      } else {
        alert('Failed to save deck');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving deck');
    } finally {
      setSaving(false);
    }
  }

  function addCardToEdit(cardName: string, qty: number = 1) {
    setEditCards(prev => ({
      ...prev,
      [cardName]: (prev[cardName] || 0) + qty,
    }));
    setSearchInput('');
    setSearchResults([]);
  }

  function removeCardFromEdit(cardName: string) {
    setEditCards(prev => {
      const updated = { ...prev };
      delete updated[cardName];
      return updated;
    });
  }

  function updateCardQtyInEdit(cardName: string, qty: number) {
    if (qty <= 0) {
      removeCardFromEdit(cardName);
    } else {
      setEditCards(prev => ({ ...prev, [cardName]: qty }));
    }
  }

  // Helper to get card type from typeLine
  function getCardType(typeLine: string | null): string {
    if (!typeLine) return 'Other';
    const lower = typeLine.toLowerCase();
    if (lower.includes('creature')) return 'Creatures';
    if (lower.includes('instant')) return 'Instants';
    if (lower.includes('sorcery')) return 'Sorceries';
    if (lower.includes('artifact')) return 'Artifacts';
    if (lower.includes('enchantment')) return 'Enchantments';
    if (lower.includes('planeswalker')) return 'Planeswalkers';
    if (lower.includes('land')) return 'Lands';
    return 'Other';
  }

  // Group cards by type
  function groupCardsByType(cards: Record<string, number>, isEditMode: boolean = false) {
    const source = isEditMode ? editCards : cards;
    const groups: Record<string, Array<[string, number]>> = {};
    const typeOrder = ['Creatures', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Planeswalkers', 'Lands', 'Other'];

    Object.entries(source).forEach(([name, qty]) => {
      const cardData = getCardData(name);
      const type = getCardType(cardData?.typeLine || null);
      if (!groups[type]) groups[type] = [];
      groups[type].push([name, qty]);
    });

    // Sort within each group alphabetically
    Object.keys(groups).forEach(type => {
      groups[type].sort(([a], [b]) => a.localeCompare(b));
    });

    // Return in type order
    return typeOrder.filter(t => groups[t]).map(t => [t, groups[t]] as const);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={editMode ? () => setEditMode(false) : onBack}
          className="text-xs sm:text-sm text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap"
        >
          {editMode ? '✕ Cancel Edit' : '← Back'}
        </button>
        <div className="flex gap-2">
          {!editMode && (
            <button
              type="button"
              onClick={handleEditStart}
              className="text-xs sm:text-sm text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              ✏️ Edit
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (confirm('Delete this deck?')) {
                await fetch(`/api/decks/${deck.id}`, { method: 'DELETE' });
                onDelete();
              }
            }}
            className="text-xs sm:text-sm text-red-400 hover:text-red-300 transition-colors whitespace-nowrap"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Deck Info */}
      <div className="space-y-1 sm:space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100">{deck.name}</h2>
        <p className="text-sm sm:text-base text-zinc-500">{deck.format}</p>
        {deck.commander && <p className="text-sm text-purple-400">Commander: {deck.commander}</p>}
        {deck.strategy && <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2">{deck.strategy}</p>}
      </div>

      {/* Coverage Stats - only for decks, not lists */}
      {deck.format !== 'List' && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-4">
          <div className="text-xs text-zinc-500 mb-1">📄 Paper</div>
          <div className={`text-xl sm:text-2xl font-bold ${paperPct >= 90 ? 'text-emerald-400' : paperPct >= 70 ? 'text-amber-400' : 'text-zinc-300'}`}>{paperPct.toFixed(0)}%</div>
          <div className="text-xs text-zinc-500 mt-0.5">{paperOwned}/{deckCards.length} cards</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-4">
          <div className="text-xs text-zinc-500 mb-1">⚡ Arena</div>
          <div className={`text-xl sm:text-2xl font-bold ${arenaPct >= 90 ? 'text-emerald-400' : arenaPct >= 70 ? 'text-purple-400' : 'text-zinc-300'}`}>{arenaPct.toFixed(0)}%</div>
          <div className="text-xs text-zinc-500 mt-0.5">{arenaOwned}/{deckCards.length} cards</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-4">
          <div className="text-xs text-zinc-500 mb-0.5 sm:mb-1">Missing</div>
          <div className="text-xl sm:text-2xl font-bold text-red-400">{missingCards.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-4">
          <div className="text-xs text-zinc-500 mb-0.5 sm:mb-1">Total Value</div>
          <div className="text-xl sm:text-2xl font-bold text-cyan-400">${totalValue.toFixed(2)}</div>
        </div>
      </div>
      )}

      {/* Action Buttons */}
      {deck.format !== 'List' && (
        <div className="flex gap-2">
          {missingCards.length > 0 && (
            <BuyOnTCGPlayer
              cards={missingCards.map(([name, quantity]) => ({ name, quantity }))}
              label={`🛒 ${missingCards.length} Missing`}
              size="sm"
              className="flex-1"
            />
          )}
          <BuyOnTCGPlayer
            cards={deckCards.map(([name, quantity]) => ({ name, quantity }))}
            label="🛒 Full Deck"
            size="sm"
            className="flex-1 !bg-zinc-700 !text-zinc-100 hover:!bg-zinc-600"
          />
          <button
            type="button"
            onClick={() => {
              const cardLines = deckCards
                .map(([name, qty]) => `${qty}x ${name}`)
                .join('\n');
              const prompt = `Here is my ${deck.format || 'Commander'} deck "${deck.name}":\n\n${cardLines}\n\nPlease analyze this deck and suggest the top improvements as swap pairs (cut + add). Then give me an optimized version as a full deck list I can save.`;
              window.dispatchEvent(new CustomEvent('khoa-prompt', { detail: prompt }));
            }}
            className="flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-black bg-purple-400 hover:bg-purple-300 transition-colors"
          >
            ✨ Ask Khoa
          </button>
        </div>
      )}

      {/* Edit Mode */}
      {editMode && (
        <div className="space-y-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-zinc-100">✏️ Edit {deck.format === 'List' ? 'List' : 'Deck'} Cards</h3>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Search and Add Cards</label>
            <input
              type="text"
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value);
                handleSearchCards(e.target.value);
              }}
              placeholder={searching ? 'Searching...' : 'Search for a card...'}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg">
                {searchResults.map(card => (
                  <button
                    key={card.name}
                    type="button"
                    onClick={() => addCardToEdit(card.name)}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700 transition-colors text-sm text-zinc-200 border-b border-zinc-700 last:border-b-0"
                  >
                    {card.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-zinc-400 mb-3">Cards ({Object.values(editCards).reduce((a, b) => a + b, 0)} total, {Object.keys(editCards).length} unique)</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto bg-zinc-800 rounded-lg p-4">
              {Object.entries(editCards).length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">No cards added</p>
              ) : (
                groupCardsByType({}, true).map(([type, cards]) => (
                  <div key={type}>
                    <h5 className="text-xs font-semibold text-amber-400 mb-2 uppercase">{type}</h5>
                    <div className="space-y-1 ml-2">
                      {cards.map(([cardName, qty]) => (
                        <div key={cardName} className="flex items-center gap-2 text-xs bg-zinc-700 rounded p-2">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={qty}
                            onChange={e => updateCardQtyInEdit(cardName, parseInt(e.target.value) || 0)}
                            title="Card quantity"
                            className="w-10 bg-zinc-600 border border-zinc-500 rounded px-1 py-0.5 text-zinc-100 text-center"
                          />
                          <span className="flex-1 truncate text-zinc-200">{cardName}</span>
                          <button
                            type="button"
                            onClick={() => removeCardFromEdit(cardName)}
                            className="text-red-400 hover:text-red-300 transition-colors font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdits}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}


      {/* List View - for lists, show sortable table */}
      {deck.format === 'List' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-zinc-100">📋 Cards in List ({deckCards.length})</h3>
            {deckCards.length > 0 && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const text = deckCards.map(([name, qty]) => {
                      const card = getCardData(name);
                      const suffix = card?.set && card?.collectorNumber ? ` (${card.set}) ${card.collectorNumber}` : '';
                      return `${qty} ${name}${suffix}`;
                    }).join('\n');
                    navigator.clipboard.writeText(text).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
                >
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = deckCards.map(([name, qty]) => {
                      const card = getCardData(name);
                      const suffix = card?.set && card?.collectorNumber ? ` (${card.set}) ${card.collectorNumber}` : '';
                      return `${qty} ${name}${suffix}`;
                    }).join('\n');
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${deck.name}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
                >
                  ↓ Export
                </button>
                <BuyOnTCGPlayer
                  cards={deckCards.map(([name, quantity]) => ({ name, quantity }))}
                  label="🛒 Buy List"
                  size="sm"
                />
              </div>
            )}
          </div>
          {deckCards.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-600">None yet</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 p-4 border-b border-zinc-800 bg-zinc-800/50 text-xs font-semibold text-zinc-400 uppercase">
                <button type="button" onClick={() => handleSort('name')} className="col-span-3 text-left hover:text-zinc-200 transition-colors">
                  Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button type="button" onClick={() => handleSort('qty')} className="col-span-1 text-center hover:text-zinc-200 transition-colors">
                  Qty {sortColumn === 'qty' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button type="button" onClick={() => handleSort('price')} className="col-span-2 text-right hover:text-zinc-200 transition-colors">
                  Price {sortColumn === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button type="button" onClick={() => handleSort('type')} className="col-span-2 text-left hover:text-zinc-200 transition-colors">
                  Type {sortColumn === 'type' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button type="button" onClick={() => handleSort('cmc')} className="col-span-1 text-center hover:text-zinc-200 transition-colors">
                  CMC {sortColumn === 'cmc' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button type="button" onClick={() => handleSort('color')} className="col-span-1 text-left hover:text-zinc-200 transition-colors">
                  Color {sortColumn === 'color' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <div className="col-span-2 text-left">
                  Owned In
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-zinc-800">
                {sortedOwnedCards.map(([name, qty]) => {
                  const card = getCardData(name);
                  const totalPrice = (card?.priceUsd ?? 0) * qty;
                  const colorStr = card?.colors?.join('') || 'C';
                  const types = cardCollectionTypes.get(name);

                  // Determine ownership status
                  let ownedIn = '—';
                  if (types && types.size > 0) {
                    const hasP = types.has('paper');
                    const hasA = types.has('arena');
                    if (hasP && hasA) {
                      ownedIn = '📄 ⚡';
                    } else if (hasP) {
                      ownedIn = '📄';
                    } else if (hasA) {
                      ownedIn = '⚡';
                    }
                  } else {
                    ownedIn = '❌';
                  }

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => onCardClick?.(name)}
                      className="w-full grid grid-cols-12 gap-2 p-4 text-sm text-left hover:bg-zinc-800 transition-colors"
                    >
                      <span className="col-span-3 text-zinc-300 truncate">{name}</span>
                      <span className="col-span-1 text-center text-zinc-400">{qty}</span>
                      <span className="col-span-2 text-right text-amber-400">${totalPrice.toFixed(2)}</span>
                      <span className="col-span-2 text-zinc-500 truncate text-xs">{card?.typeLine ?? '—'}</span>
                      <span className="col-span-1 text-center text-zinc-400">{card?.cmc ?? '—'}</span>
                      <span className="col-span-1 text-zinc-400">{colorStr}</span>
                      <span className="col-span-2 text-center text-sm">{ownedIn}</span>
                    </button>
                  );
                })}
              </div>

              {/* Total */}
              {(() => {
                const listTotal = deckCards.reduce((s, [name, qty]) => {
                  const card = getCardData(name);
                  return s + (card?.priceUsd ?? 0) * qty;
                }, 0);
                return listTotal > 0 ? (
                  <div className="border-t border-zinc-800 p-4 text-sm font-semibold text-amber-400 bg-zinc-800/30">
                    Total: ${listTotal.toFixed(2)}
                  </div>
                ) : null;
              })()}
            </div>
          )}
          {deckCards.length > 0 && (
            <div className="mt-1">
              <BuyOnTCGPlayer
                cards={deckCards.map(([name, quantity]) => ({ name, quantity }))}
                label="🛒 Buy List on TCGPlayer"
              />
            </div>
          )}
        </div>
      ) : (
        /* Deck View - grouped by type */
        <div className={`grid gap-6 grid-cols-1 md:grid-cols-2`}>
          {/* Color key */}
          <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
            <span className="font-semibold uppercase tracking-wider text-zinc-600 mr-1">Colors:</span>
            {([['W','White','text-yellow-100'],['U','Blue','text-blue-400'],['B','Black','text-zinc-300'],['R','Red','text-red-400'],['G','Green','text-green-400'],['C','Colorless','text-zinc-500']] as const).map(([letter, label, cls]) => (
              <span key={letter} className="flex items-center gap-1">
                <span className={`text-[9px] font-bold px-1 rounded bg-zinc-700 ${cls}`}>{letter}</span>
                <span>{label}</span>
              </span>
            ))}
          </div>
          {/* Owned Cards */}
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-100">
              ✓ Cards You Own ({ownedCards.length})
            </h3>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              {ownedCards.length === 0 ? (
                <p className="text-sm text-zinc-600">None yet</p>
              ) : (
                groupCardsByType(Object.fromEntries(ownedCards)).map(([type, cards]) => (
                  <div key={type}>
                    <p className="text-xs font-semibold text-amber-400 uppercase mb-2">{type}</p>
                    <div className="space-y-1 ml-2">
                      {cards.map(([name, qty]) => {
                        const cardData = getCardData(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => onCardClick?.(name)}
                            className="w-full flex items-center justify-between text-xs text-left hover:bg-zinc-800 p-2 -mx-2 rounded transition-colors"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <ColorPips colors={cardData?.colors} />
                              <span className="text-zinc-300 truncate">{qty}x {name}</span>
                            </span>
                            <span className="text-amber-400 shrink-0 ml-2">{isBasicLand(name) ? '$0.00' : `$${((collectionLower.get(name.toLowerCase())?.data?.priceUsd ?? 0) * qty).toFixed(2)}`}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              {ownedValue > 0 && (
                <div className="border-t border-zinc-700 pt-2 mt-2 text-sm font-semibold text-amber-400">
                  Total: ${ownedValue.toFixed(2)}
                </div>
              )}
            </div>
          </div>

        {/* Missing Cards - only show for decks */}
        {deck.format !== 'List' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-zinc-100">✗ Cards You Need ({missingCards.length})</h3>
            {missingCards.length > 0 && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const text = missingCards.map(([name, qty]) => `${qty}x ${name}`).join('\n');
                    navigator.clipboard.writeText(text).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
                >
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = missingCards.map(([name, qty]) => `${qty}x ${name}`).join('\n');
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${deck.name} - Missing Cards.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
                >
                  ↓ Export
                </button>
                <BuyOnTCGPlayer
                  cards={missingCards.map(([name, quantity]) => ({ name, quantity }))}
                  label="🛒 Buy Missing"
                  size="sm"
                />
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            {missingCards.length === 0 ? (
              <p className="text-sm text-emerald-400">You own all cards! ✓</p>
            ) : (
              groupCardsByType(Object.fromEntries(missingCards)).map(([type, cards]) => (
                <div key={type}>
                  <p className="text-xs font-semibold text-red-400 uppercase mb-2">{type}</p>
                  <div className="space-y-1 ml-2">
                    {cards.map(([name, qty]) => {
                      const cardData = getCardData(name);
                      const price = isBasicLand(name) ? 0 : (cardData?.priceUsd ?? 0);
                      const hasData = isBasicLand(name) || cardData != null;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onCardClick?.(name)}
                          className="w-full flex items-center justify-between text-xs text-left hover:bg-zinc-800 p-2 -mx-2 rounded transition-colors"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <ColorPips colors={cardData?.colors} />
                            <span className="text-zinc-400 truncate">{qty}x {name}</span>
                          </span>
                          <span className={`shrink-0 ml-2 ${price > 0 ? 'text-amber-400 font-semibold' : 'text-zinc-600'}`}>
                            {isBasicLand(name) ? '$0.00' : price > 0 ? `$${(price * qty).toFixed(2)}` : hasData ? '$0.00' : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            {missingCards.length > 0 && (
              <div className="border-t border-zinc-700 pt-2 mt-2 text-sm text-zinc-400">
                To acquire: {missingCards.length} unique cards
              </div>
            )}
          </div>
          {deckCards.length > 0 && (
            <div className="mt-3">
              <BuyOnTCGPlayer
                cards={deckCards.map(([name, quantity]) => ({ name, quantity }))}
                label="🛒 Buy Full Deck on TCGPlayer"
              />
            </div>
          )}
        </div>
        )}
        </div>
      )}
    </div>
  );
}
