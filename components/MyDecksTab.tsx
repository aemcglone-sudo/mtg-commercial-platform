'use client';

import { useState, useEffect, useMemo } from 'react';
import type { CollectionCardData } from './CollectionBrowser';
import CardDetailModal from './CardDetailModal';

interface Deck {
  id: string;
  name: string;
  format: string;
  strategy: string;
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
  const [loading, setLoading] = useState(true);
  const [collectionType, setCollectionType] = useState<'paper' | 'arena'>('paper');
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
        setDecks(Array.isArray(data) ? data : (data.decks || []));
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

  // Filter collection by type
  const filteredCollection = collection.filter(c => (c.collectionType ?? 'paper') === collectionType);
  const collectionMap = new Map(filteredCollection.map(c => [c.name, c]));

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
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="px-8 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
        >
          Create New Deck
        </button>
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
        <div className="flex items-center gap-3">
          {/* Collection type toggle */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setCollectionType('paper')}
              className={`px-3 py-1.5 transition-colors ${collectionType === 'paper' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              📄 Paper
            </button>
            <button
              type="button"
              onClick={() => setCollectionType('arena')}
              className={`px-3 py-1.5 transition-colors ${collectionType === 'arena' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              ⚡ Arena
            </button>
          </div>
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
                const ownedCount = deckCards.filter(([name]) => collectionMap.has(name)).length;
                const coveragePct = deckCards.length > 0 ? (ownedCount / deckCards.length) * 100 : 0;

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
                        <p className="text-xs text-zinc-500">{deck.format}</p>
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
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-400 font-medium">{ownedCount} owned</span>
                          <span className={`font-semibold ${coveragePct >= 90 ? 'text-emerald-400' : coveragePct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                            {coveragePct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              coveragePct >= 90 ? 'bg-emerald-500' : coveragePct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(coveragePct, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-zinc-600">
                          {deckCards.length - ownedCount} card{deckCards.length - ownedCount !== 1 ? 's' : ''} needed
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
              <p className="text-sm text-zinc-500 py-4">No lists yet. Ask Shahrazad to create one!</p>
            ) : (
              listsList.map(deck => {
          const deckCards = Object.entries(deck.cards || {});
          const ownedCount = deckCards.filter(([name]) => collectionMap.has(name)).length;
          const coveragePct = deckCards.length > 0 ? (ownedCount / deckCards.length) * 100 : 0;

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
                    <p className="text-xs text-zinc-500">{deck.format}</p>
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

                {/* List stats - only show for decks, not lists */}
                {deckCards.length > 0 && deck.format !== 'List' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-400 font-medium">{ownedCount} owned</span>
                      <span className={`font-semibold ${coveragePct >= 90 ? 'text-emerald-400' : coveragePct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                        {coveragePct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          coveragePct >= 90 ? 'bg-emerald-500' : coveragePct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(coveragePct, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-zinc-600">
                      {deckCards.length - ownedCount} card{deckCards.length - ownedCount !== 1 ? 's' : ''} needed
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

function NewDeckForm({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('Commander');
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

  function handlePasteDeckList() {
    const cards: Record<string, number> = {};
    if (pasteInput.trim()) {
      const lines = pasteInput.split('\n');
      for (const line of lines) {
        const match = line.match(/^(\d+)x?\s+(.+)$/i);
        if (match) {
          const qty = parseInt(match[1]);
          const cardName = match[2].trim();
          if (cardName && qty > 0) {
            cards[cardName] = (cards[cardName] || 0) + qty;
          }
        }
      }
    }
    setDeckCards(prev => ({ ...prev, ...cards }));
    setPasteInput('');
    setShowPasteDeckList(false);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    if (format === 'Commander' && !commander.trim()) {
      setError('Commander is required for Commander format');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const deckData: any = { name, format, strategy, cards: deckCards };
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
              <option>Modern</option>
              <option>Legacy</option>
            </select>
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
            <div className="space-y-2">
              <textarea
                value={pasteInput}
                onChange={e => setPasteInput(e.target.value)}
                placeholder={`4 Lightning Bolt\n4 Counterspell\n20 Island`}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none font-mono text-sm"
              />
              <button
                type="button"
                onClick={handlePasteDeckList}
                className="text-xs px-3 py-1 rounded bg-amber-400/20 text-amber-400 hover:bg-amber-400/30 transition-colors"
              >
                Add from list
              </button>
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

function TCGPlayerButton({ missingCards }: { missingCards: Array<[string, number]> }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/tcgplayer-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: missingCards }),
      });

      if (res.ok) {
        const { cartUrl } = await res.json();
        window.open(cartUrl, '_blank');
      } else {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to generate cart link: ${error.error || 'Please try again'}`);
      }
    } catch (err) {
      console.error('Failed to generate TCGPlayer cart:', err);
      alert('Failed to generate cart link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full px-6 py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
    >
      🛒 {loading ? 'Loading…' : `Buy ${missingCards.length} Missing Card${missingCards.length !== 1 ? 's' : ''} on TCGPlayer`}
    </button>
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

  const deckCards = Object.entries(deck.cards || {});
  const ownedCards = deckCards.filter(([name]) => collection.has(name));
  const missingCards = deckCards.filter(([name]) => !collection.has(name));
  const coveragePct = deckCards.length > 0 ? (ownedCards.length / deckCards.length) * 100 : 0;
  const ownedValue = ownedCards.reduce((s, [name, qty]) => {
    const price = collection.get(name)?.priceUsd ?? 0;
    return s + price * qty;
  }, 0);
  const missingValue = missingCards.reduce((s, [name, qty]) => {
    const price = collection.get(name)?.priceUsd ?? 0;
    return s + price * qty;
  }, 0);

  // Helper function to get card data from any source (owned or unowned)
  const getCardData = (name: string) => {
    // First try the filtered collection (for owned cards)
    if (collection.has(name)) {
      return collection.get(name);
    }
    // Then try the full collection (for unowned cards)
    return allCollectionCards.find(c => c.name === name);
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

  function handleSort(column: typeof sortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs sm:text-sm text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap"
        >
          ← Back
        </button>
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

      {/* Deck Info */}
      <div className="space-y-1 sm:space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100">{deck.name}</h2>
        <p className="text-sm sm:text-base text-zinc-500">{deck.format}</p>
        {deck.commander && <p className="text-sm text-purple-400">Commander: {deck.commander}</p>}
        {deck.strategy && <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2">{deck.strategy}</p>}
      </div>

      {/* Coverage Stats - only for decks, not lists */}
      {deck.format !== 'List' && (
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-4">
          <div className="text-xs text-zinc-500 mb-0.5 sm:mb-1">Coverage</div>
          <div className="text-xl sm:text-2xl font-bold text-amber-400">{coveragePct.toFixed(0)}%</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-4">
          <div className="text-xs text-zinc-500 mb-0.5 sm:mb-1">Owned</div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400">{ownedCards.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-4">
          <div className="text-xs text-zinc-500 mb-0.5 sm:mb-1">Missing</div>
          <div className="text-xl sm:text-2xl font-bold text-red-400">{missingCards.length}</div>
        </div>
      </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {deck.format !== 'List' && missingCards.length > 0 && (
          <TCGPlayerButton missingCards={missingCards} />
        )}
        {deck.format !== 'List' && (
          <button
            type="button"
            onClick={() => {
              // Store deck ID in session storage for Shahrazad to reference
              sessionStorage.setItem('deckToAnalyze', deck.id);
              // Trigger Shahrazad to analyze this deck
              window.dispatchEvent(new CustomEvent('analyzeDeck', { detail: { deckId: deck.id, deckName: deck.name } }));
            }}
            className="w-full px-6 py-3 rounded-xl font-semibold text-black bg-purple-400 hover:bg-purple-300 transition-colors"
          >
            🧙 Analyze with Shahrazad
          </button>
        )}
      </div>

      {/* List View - for lists, show sortable table */}
      {deck.format === 'List' ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-zinc-100">
            📋 Cards in List ({ownedCards.length})
          </h3>
          {ownedCards.length === 0 ? (
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
        </div>
      ) : (
        /* Deck View - original two-column layout */
        <div className={`grid gap-6 grid-cols-1 md:grid-cols-2`}>
          {/* Owned Cards */}
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-100">
              ✓ Cards You Own ({ownedCards.length})
            </h3>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              {ownedCards.length === 0 ? (
                <p className="text-sm text-zinc-600">None yet</p>
              ) : (
                ownedCards.map(([name, qty]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onCardClick?.(name)}
                    className="w-full flex justify-between text-sm text-left hover:bg-zinc-800 p-2 -mx-2 rounded transition-colors"
                  >
                    <span className="text-zinc-300">{qty}x {name}</span>
                    <span className="text-amber-400">${(collection.get(name)?.priceUsd ?? 0).toFixed(2)}</span>
                  </button>
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
          <h3 className="font-semibold text-zinc-100">✗ Cards You Need ({missingCards.length})</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            {missingCards.length === 0 ? (
              <p className="text-sm text-emerald-400">You own all cards! ✓</p>
            ) : (
              missingCards.map(([name, qty]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onCardClick?.(name)}
                  className="w-full flex justify-between text-sm text-left hover:bg-zinc-800 p-2 -mx-2 rounded transition-colors"
                >
                  <span className="text-zinc-400">{qty}x {name}</span>
                  <span className="text-zinc-600">—</span>
                </button>
              ))
            )}
            {missingCards.length > 0 && (
              <div className="border-t border-zinc-700 pt-2 mt-2 text-sm text-zinc-400">
                To acquire: {missingCards.length} unique cards
              </div>
            )}
          </div>
        </div>
        )}
        </div>
      )}
    </div>
  );
}
