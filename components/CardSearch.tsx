'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { isInstantSpeed } from '@/lib/rules-hints';

interface ScryfallCard {
  id: string;
  name: string;
  image_uris?: { small: string; normal: string };
  card_faces?: Array<{ image_uris?: { small: string; normal: string } }>;
  prices?: { usd?: string | null };
  set_name?: string;
  scryfall_uri?: string;
  type_line?: string;
  oracle_text?: string;
}

interface Props {
  onAdd: (name: string, quantity: number) => Promise<void>;
  onClose: () => void;
  onAskAboutCard?: (cardName: string, defaultQuestion: string) => void;
}

function getImage(card: ScryfallCard): string {
  return card.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.normal
    ?? '';
}

export default function CardSearch({ onAdd, onClose, onAskAboutCard }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loadingCard, setLoadingCard] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedName, setAddedName] = useState('');
  const [showInstantSpeedTip, setShowInstantSpeedTip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Autocomplete via Scryfall
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions((data.data ?? []).slice(0, 8));
        }
      } catch { /* ignore */ }
    }, 250);
  }, [query]);

  const selectCard = useCallback(async (name: string) => {
    setQuery(name);
    setSuggestions([]);
    setLoadingCard(true);
    setSelectedCard(null);
    setShowInstantSpeedTip(false);
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
      );
      if (res.ok) {
        const card = await res.json();
        setSelectedCard(card);
        if (isInstantSpeed({ typeLine: card.type_line, oracleText: card.oracle_text })) {
          setShowInstantSpeedTip(true);
        }
      }
    } catch { /* ignore */ }
    setLoadingCard(false);
  }, []);

  async function handleAdd() {
    if (!selectedCard) return;
    setAdding(true);
    try {
      await onAdd(selectedCard.name, quantity);
      setAddedName(selectedCard.name);
      setSelectedCard(null);
      setQuery('');
      setQuantity(1);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="font-semibold text-zinc-100">Add a card</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Search input + autocomplete */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedCard(null); setAddedName(''); }}
              placeholder="Search any Magic card…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden z-50 shadow-lg max-h-40 overflow-y-auto">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectCard(name)}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors block"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loading */}
          {loadingCard && (
            <p className="text-center text-zinc-600 text-sm py-4">Loading card…</p>
          )}

          {/* Card preview */}
          {selectedCard && (
            <div className="flex gap-4 items-start">
              {getImage(selectedCard) && (
                <img
                  src={getImage(selectedCard)}
                  alt={selectedCard.name}
                  className="w-28 rounded-lg border border-zinc-700 shrink-0"
                />
              )}
              <div className="flex-1 space-y-3">
                <div>
                  <p className="font-semibold text-zinc-100">{selectedCard.name}</p>
                  {selectedCard.set_name && (
                    <p className="text-xs text-zinc-500 mt-0.5">{selectedCard.set_name}</p>
                  )}
                  {selectedCard.prices?.usd && (
                    <p className="text-xs text-amber-400 mt-0.5">${selectedCard.prices.usd}</p>
                  )}
                </div>

                {/* Instant-speed tooltip */}
                {showInstantSpeedTip && (
                  <div className="rounded-lg bg-blue-900/50 border border-blue-700 p-3">
                    <p className="text-sm text-blue-200 mb-2">
                      💡 <strong>Instant speed mechanic:</strong> This card can cast on your opponent's turn. Want to learn how that works?
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const question = `How does instant speed work with ${selectedCard.name}? I'm new to this mechanic.`;
                        onAskAboutCard?.(selectedCard.name, question);
                      }}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold text-blue-900 bg-blue-400 hover:bg-blue-300 transition-colors"
                    >
                      Ask about instant speed
                    </button>
                  </div>
                )}

                {/* Quantity picker */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500">Quantity</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-bold transition-colors"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-mono text-zinc-200">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
                >
                  {adding ? 'Adding…' : `Add ${quantity}× to collection`}
                </button>
              </div>
            </div>
          )}

          {/* Success message */}
          {addedName && !selectedCard && (
            <p className="text-center text-emerald-400 text-sm">
              ✓ {addedName} added to your collection
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
