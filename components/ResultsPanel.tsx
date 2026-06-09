'use client';

import { useState, useEffect } from 'react';
import type { MatchedDeck } from '@/lib/deck-matcher';
import DeckCard from './DeckCard';
import FormatTabs from './FormatTabs';
import CollectionBrowser, { type CollectionCardData } from './CollectionBrowser';

type DeckWithoutCards = Omit<MatchedDeck, 'cards'>;

interface CollectionResult {
  collectionSize: number;
  totalCards: number;
  detectedFormat: string;
  collectionCards: CollectionCardData[];
}

interface DeckResult {
  buildable: DeckWithoutCards[];
  aspirational: DeckWithoutCards[];
}

interface Props {
  collection: CollectionResult;
  decks: DeckResult | null;
  analyzing: boolean;
  analyzeError: string;
  onAnalyze: () => void;
}

type Section = 'collection' | 'buildable' | 'aspirational';
type FormatFilter = 'All' | 'Standard' | 'Pioneer' | 'Commander';

export default function ResultsPanel({ collection, decks, analyzing, analyzeError, onAnalyze }: Props) {
  const [section, setSection] = useState<Section>('collection');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('All');

  // Auto-switch to buildable when decks first arrive
  useEffect(() => {
    if (decks && section === 'collection') {
      setSection(decks.buildable.length > 0 ? 'buildable' : 'aspirational');
    }
  }, [decks]); // eslint-disable-line react-hooks/exhaustive-deps

  const deckList = section === 'buildable' ? (decks?.buildable ?? []) : (decks?.aspirational ?? []);
  const filtered = formatFilter === 'All' ? deckList : deckList.filter((d) => d.format === formatFilter);

  const counts = (src: DeckWithoutCards[]) => ({
    All: src.length,
    Standard: src.filter((d) => d.format === 'Standard').length,
    Pioneer: src.filter((d) => d.format === 'Pioneer').length,
    Commander: src.filter((d) => d.format === 'Commander').length,
  });

  const formatCounts = counts(deckList);

  const formatTabs = (['All', 'Standard', 'Pioneer', 'Commander'] as FormatFilter[]).map((f) => ({
    id: f,
    label: f,
    count: formatCounts[f],
  }));

  const totalValue = collection.collectionCards.reduce(
    (s, c) => s + c.quantity * (c.priceUsd ?? 0),
    0
  );

  return (
    <div className="w-full space-y-6">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm">
        <div>
          <span className="text-zinc-500">Unique cards </span>
          <span className="text-zinc-100 font-semibold">{collection.collectionSize.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-zinc-500">Total copies </span>
          <span className="text-zinc-100 font-semibold">{collection.totalCards.toLocaleString()}</span>
        </div>
        {totalValue > 0 && (
          <div>
            <span className="text-zinc-500">Collection value </span>
            <span className="text-amber-400 font-semibold">~${totalValue.toFixed(2)}</span>
          </div>
        )}
        {decks && (
          <div>
            <span className="text-zinc-500">Decks analyzed </span>
            <span className="text-zinc-100 font-semibold">
              {(decks.buildable.length + decks.aspirational.length).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Top-level section tabs */}
      <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-sm">
        {/* Collection tab — always available */}
        <button
          type="button"
          onClick={() => setSection('collection')}
          className={`flex-1 py-2.5 px-4 font-medium transition-colors ${
            section === 'collection' ? 'bg-amber-400 text-black' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          My Collection
          <span className={`ml-1.5 text-xs ${section === 'collection' ? 'text-black/60' : 'text-zinc-600'}`}>
            {collection.collectionSize.toLocaleString()}
          </span>
        </button>

        {/* Deck tabs — show loading state before results arrive */}
        {(['buildable', 'aspirational'] as const).map((id) => {
          const label = id === 'buildable' ? 'Ready to Build' : 'Aspiration Decks';
          const count = id === 'buildable' ? decks?.buildable.length : decks?.aspirational.length;
          const active = section === id;

          if (!decks && !analyzing) {
            // Not yet triggered — show CTA placeholder
            return null;
          }

          return (
            <button
              key={id}
              type="button"
              disabled={!decks}
              onClick={() => { setSection(id); setFormatFilter('All'); }}
              className={`flex-1 py-2.5 px-4 font-medium transition-colors disabled:cursor-default ${
                active ? 'bg-amber-400 text-black'
                : decks ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-700'
              }`}
            >
              {label}
              {decks ? (
                <span className={`ml-1.5 text-xs ${active ? 'text-black/60' : 'text-zinc-600'}`}>
                  {count}
                </span>
              ) : (
                <span className="ml-1.5 text-xs text-zinc-700">…</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collection browser */}
      {section === 'collection' && (
        <div className="space-y-6">
          <CollectionBrowser
            cards={collection.collectionCards}
            totalCards={collection.totalCards}
            detectedFormat={collection.detectedFormat}
          />

          {/* Deck analysis CTA — shown when decks haven't been fetched yet */}
          {!decks && !analyzing && (
            <div className="border border-zinc-800 rounded-xl p-6 text-center space-y-3 bg-zinc-900/40">
              <p className="text-zinc-300 font-medium">Ready to find your best decks?</p>
              <p className="text-zinc-500 text-sm">
                We&apos;ll match your collection against the current Standard, Pioneer, and Commander
                metagame and show you exactly what you can build.
              </p>
              {analyzeError && <p className="text-red-400 text-sm">{analyzeError}</p>}
              <button
                type="button"
                onClick={onAnalyze}
                className="px-6 py-2.5 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
              >
                Find My Best Decks
              </button>
            </div>
          )}

          {/* Analyzing indicator */}
          {analyzing && (
            <div className="border border-zinc-800 rounded-xl p-6 text-center space-y-2 bg-zinc-900/40">
              <p className="text-zinc-300 font-medium animate-pulse">Fetching the latest metagame…</p>
              <p className="text-zinc-600 text-sm">
                Pulling deck lists from MTGTop8 and EDHREC. This takes about 30–60 seconds.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Deck views */}
      {section !== 'collection' && decks && (
        <>
          <p className="text-sm text-zinc-500">
            {section === 'buildable'
              ? 'Decks where you already own 70%+ of the cards — sorted by coverage.'
              : 'Competitive decks you might aspire to. Sorted by how close you already are.'}
          </p>

          <FormatTabs
            tabs={formatTabs}
            active={formatFilter}
            onChange={(id) => setFormatFilter(id as FormatFilter)}
          />

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                {section === 'buildable'
                  ? 'No decks at 70%+ coverage — check Aspiration Decks to see how close you are.'
                  : 'No decks found for this filter.'}
              </div>
            ) : (
              filtered.map((deck, i) => <DeckCard key={deck.id} deck={deck} rank={i} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
