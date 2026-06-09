'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  onAdd: (name: string, quantity: number) => Promise<void>;
}

export default function QuickAddCard({ onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
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

  async function handleAdd(name: string) {
    setLoading(true);
    try {
      await onAdd(name, 1);
      setQuery('');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1 w-full">
      <div className="flex gap-2 w-full">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions.length > 0) {
              handleAdd(suggestions[0]);
            }
          }}
          placeholder="Add a card…"
          disabled={loading}
          className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => suggestions.length > 0 && handleAdd(suggestions[0])}
          disabled={!query.trim() || suggestions.length === 0 || loading}
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 transition-colors"
        >
          {loading ? '…' : 'Add'}
        </button>
      </div>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleAdd(name)}
              disabled={loading}
              className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
