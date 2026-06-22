'use client';

import { useState, useRef, useEffect } from 'react';
import CardDetailModal from './CardDetailModal';

interface Props {
  onAdd: (name: string, quantity: number) => Promise<void>;
  onCollectionChange?: () => void;
}

export default function QuickAddCard({ onAdd, onCollectionChange }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pendingCard, setPendingCard] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions((data.data ?? []).slice(0, 5));
        }
      } catch { /* ignore */ }
    }, 250);
  }, [query]);

  function openCard(name: string) {
    setPendingCard(name);
    setSuggestions([]);
    setQuery('');
  }

  return (
    <>
      <div className="space-y-1 w-full">
        <div className="flex gap-2 w-full">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions.length > 0) openCard(suggestions[0]);
            }}
            placeholder="Add a card…"
            className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button
            type="button"
            onClick={() => { if (query.trim()) openCard(suggestions[0] ?? query.trim()); }}
            disabled={!query.trim()}
            className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => openCard(name)}
                className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {pendingCard && (
        <CardDetailModal
          cardName={pendingCard}
          collectionCard={null}
          onClose={() => setPendingCard(null)}
          onCollectionChange={() => {
            onCollectionChange?.();
            setPendingCard(null);
          }}
        />
      )}
    </>
  );
}
