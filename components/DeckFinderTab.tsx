'use client';

import { useState } from 'react';
import DeckCard from './DeckCard';
import FormatTabs from './FormatTabs';
import type { MatchedDeck } from '@/lib/deck-matcher';

type DeckWithoutCards = Omit<MatchedDeck, 'cards'>;
type FormatFilter = 'All' | 'Standard' | 'Pioneer' | 'Commander';

interface Props {
  decks: { buildable: DeckWithoutCards[]; aspirational: DeckWithoutCards[]; suggested?: DeckWithoutCards[] } | null;
  analyzing: boolean;
  error: string;
  onAnalyze: () => void;
  onDeckSelected?: (deck: DeckWithoutCards) => void;
  collection?: Array<{ name: string; collectionType?: 'paper' | 'arena' }>;
}

export default function DeckFinderTab({ decks, analyzing, error, onAnalyze, onDeckSelected, collection = [] }: Props) {
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('All');
  const [selectedDeck, setSelectedDeck] = useState<DeckWithoutCards | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [strategy, setStrategy] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [collectionType, setCollectionType] = useState<'paper' | 'arena'>('paper');

  const filterByFormat = (list: DeckWithoutCards[]) =>
    formatFilter === 'All' ? list : list.filter((d) => d.format === formatFilter);

  const aspirationalFiltered = filterByFormat(decks?.aspirational ?? []);

  const getCounts = (src: DeckWithoutCards[]) => ({
    All: src.length,
    Standard: src.filter((d) => d.format === 'Standard').length,
    Pioneer: src.filter((d) => d.format === 'Pioneer').length,
    Commander: src.filter((d) => d.format === 'Commander').length,
  });

  const allDecks = decks?.aspirational ?? [];
  const allCounts = getCounts(allDecks);

  const formatTabs = (['All', 'Standard', 'Pioneer', 'Commander'] as FormatFilter[]).map((f) => ({
    id: f,
    label: f,
    count: allCounts[f],
  }));

  // ── Not yet run ────────────────────────────────────────────────────────────
  if (!decks && !analyzing) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="text-center space-y-3 sm:space-y-4 py-8 sm:py-12">
          <div className="text-4xl sm:text-5xl">🔍</div>
          <h2 className="text-xl sm:text-2xl font-bold">Find Your Best Decks</h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-md mx-auto">
            We&apos;ll match your collection against the current metagame — showing both decks you can build today and ones to aspire toward.
          </p>
          {error && <p className="text-red-400 text-xs sm:text-sm">{error}</p>}
          <button
            type="button"
            onClick={onAnalyze}
            className="px-6 sm:px-8 py-2 sm:py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors text-sm sm:text-lg inline-block"
          >
            Find My Best Decks
          </button>
          <p className="text-zinc-600 text-xs">Takes 30–60 seconds</p>
        </div>

        {/* Preview of what they'll see */}
        <div className="hidden sm:grid grid-cols-2 gap-4 opacity-40 pointer-events-none select-none">
          {[
            { label: 'Ready to Build', desc: 'Decks you can assemble right now (70%+ of cards owned)', icon: '✅' },
            { label: 'Aspiration Decks', desc: 'Top meta decks with gap analysis and completion cost', icon: '⭐' },
          ].map(({ label, desc, icon }) => (
            <div key={label} className="border border-zinc-800 rounded-xl p-5 space-y-2">
              <div className="text-2xl">{icon}</div>
              <div className="font-semibold text-zinc-200">{label}</div>
              <div className="text-sm text-zinc-500">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Analyzing ──────────────────────────────────────────────────────────────
  if (analyzing) {
    return (
      <div className="text-center py-32 space-y-4">
        <div className="text-5xl animate-pulse">🔍</div>
        <p className="text-zinc-300 font-medium">Fetching the latest metagame…</p>
        <p className="text-zinc-600 text-sm">
          Pulling deck lists from MTGTop8 and EDHREC, matching against your collection.
        </p>
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Format filter + Collection type toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FormatTabs
          tabs={formatTabs}
          active={formatFilter}
          onChange={(id) => setFormatFilter(id as FormatFilter)}
        />
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
            onClick={onAnalyze}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Refresh with latest metagame data"
          >
            ↺ Re-run analysis
          </button>
        </div>
      </div>

      {/* Best Decks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-100"><span title="Top meta decks">⭐</span> Best Decks</h3>
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400">
              {aspirationalFiltered.length}
            </span>
          </div>
        </div>
        {aspirationalFiltered.length === 0 ? (
          <div className="text-center py-16 text-zinc-600 text-sm">
            No decks found for this format.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aspirationalFiltered.map((deck, i) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                rank={i}
                collectionType={collectionType}
                collection={collection}
                onSave={() => {
                  setSelectedDeck(deck);
                  setDeckName(deck.name);
                  setShowAddForm(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add to My Decks Modal */}
      {showAddForm && selectedDeck && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-xl w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h2 className="text-2xl font-bold text-zinc-100">Save "{selectedDeck.name}" to My Decks</h2>

              {saveError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-400">{saveError}</p>
                </div>
              )}
              {saveSuccess && (
                <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
                  <p className="text-sm text-green-400">{saveSuccess}</p>
                </div>
              )}

              <div>
                <label htmlFor="deckName" className="block text-sm text-zinc-400 mb-2">Deck Name</label>
                <input
                  id="deckName"
                  type="text"
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label htmlFor="strategy" className="block text-sm text-zinc-400 mb-2">Strategy (Optional)</label>
                <textarea
                  id="strategy"
                  value={strategy}
                  onChange={e => setStrategy(e.target.value)}
                  placeholder="How do you play this deck? What's the main strategy?"
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setSaveError('');
                  }}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!deckName.trim()) return;
                    setSaving(true);
                    setSaveError('');
                    setSaveSuccess('');
                    try {
                      // Extract cards from matched deck (combine haveCards and gapCards with their quantities)
                      const cardsObj: Record<string, number> = {};
                      selectedDeck.haveCards.forEach(c => {
                        cardsObj[c.name] = c.needed;
                      });
                      selectedDeck.gapCards.forEach(c => {
                        cardsObj[c.name] = c.needed;
                      });

                      console.log('Saving deck from Find Decks:', { name: deckName, format: selectedDeck.format, strategy, cards: cardsObj });
                      const res = await fetch('/api/decks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: deckName,
                          format: selectedDeck.format,
                          strategy,
                          cards: cardsObj,
                        }),
                      });
                      console.log('Save deck response:', res.status);
                      const data = await res.json();
                      console.log('Save deck data:', data);
                      if (res.ok) {
                        setSaveSuccess(`✓ Deck saved!`);
                        setTimeout(() => {
                          setShowAddForm(false);
                          setDeckName('');
                          setStrategy('');
                          setSelectedDeck(null);
                          setSaveSuccess('');
                        }, 1000);
                      } else {
                        setSaveError(data.error || 'Failed to save deck');
                      }
                    } catch (err) {
                      console.error('Save deck error:', err);
                      setSaveError(err instanceof Error ? err.message : 'Something went wrong');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={!deckName.trim() || saving}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Deck'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
