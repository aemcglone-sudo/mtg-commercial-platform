'use client';

import { useState, useEffect, useCallback } from 'react';

interface Commander {
  id: string;
  name: string;
  colorIdentity: string[];
  imageUrl: string | null;
  typeLine: string;
  oracleText: string;
  priceUsd: number | null;
}

interface PopularCommander {
  name: string;
  colors: string[];
  strategy: string;
}

interface Props {
  format: string;
  commanderExplanation: string | null;
  onCommanderHover: (name: string, oracleText: string) => void;
  onSelect: (commander: Commander) => void;
  onSkip: () => void;
  onBack: () => void;
}

const COLOR_SYMBOLS: Record<string, string> = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '💠' };

export function CommanderSearch({ format, commanderExplanation, onCommanderHover, onSelect, onSkip, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; image_uris?: { normal: string }; card_faces?: Array<{ image_uris?: { normal: string } }>; color_identity: string[]; type_line: string; oracle_text: string; prices?: { usd?: string } }>>([]);
  const [searching, setSearching] = useState(false);
  const [popular, setPopular] = useState<PopularCommander[]>([]);
  const [selected, setSelected] = useState<Commander | null>(null);

  useEffect(() => {
    fetch(`/api/deck-wizard/commanders/popular?format=${format}`)
      .then(r => r.json())
      .then((d: { commanders: PopularCommander[] }) => setPopular(d.commanders.slice(0, 8)))
      .catch(() => {});
  }, [format]);

  const search = useCallback((q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    // Scryfall must be called client-side
    fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q + ' is:commander')}&order=edhrec&dir=asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { data: typeof results }) => setResults(d.data?.slice(0, 8) ?? []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  function handleResult(card: typeof results[0]) {
    const commander: Commander = {
      id: card.id,
      name: card.name,
      colorIdentity: card.color_identity,
      imageUrl: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
      typeLine: card.type_line,
      oracleText: card.oracle_text ?? card.card_faces?.map(f => (f as { oracle_text?: string }).oracle_text ?? '').join('\n---\n'),
      priceUsd: card.prices?.usd ? parseFloat(card.prices.usd) : null,
    };
    setSelected(commander);
    setResults([]);
    setQuery('');
    const oracleText = card.oracle_text ?? card.card_faces?.map(f => (f as { oracle_text?: string }).oracle_text ?? '').join('\n---\n') ?? '';
    onCommanderHover(card.name, oracleText);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Choose Your Commander</h2>
        <p className="text-zinc-500">Your commander shapes every card choice. You can skip this step and choose later.</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for a legendary creature…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-600 transition-colors"
        />
        {searching && <span className="absolute right-3 top-3.5 text-xs text-zinc-500">Searching…</span>}
      </div>

      {/* Search results — hidden once a commander is selected */}
      {!selected && results.length > 0 && (
        <div className="mb-6 space-y-2">
          {results.map(card => (
            <button
              key={card.id}
              type="button"
              onClick={() => handleResult(card)}
              className="w-full text-left rounded-xl border p-3 transition-all flex items-center gap-3 bg-zinc-900 border-zinc-800 hover:border-zinc-600"
            >
              {(card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal}
                  alt={card.name}
                  className="w-10 h-14 rounded object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-zinc-200">
                    {card.name}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {card.color_identity.map(c => COLOR_SYMBOLS[c] ?? c).join('')}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">{card.type_line}</p>
                {card.prices?.usd && (
                  <p className="text-xs text-zinc-600 mt-0.5">${card.prices.usd}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Popular picks */}
      {!selected && popular.length > 0 && query.length < 2 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Popular Commanders</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {popular.map(cmd => (
              <button
                key={cmd.name}
                type="button"
                onClick={() => setQuery(cmd.name)}
                className="text-left rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 p-3 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-zinc-200">{cmd.name}</span>
                  <span className="text-xs">{cmd.colors.map(c => COLOR_SYMBOLS[c] ?? c).join('')}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{cmd.strategy}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {selected && (
        <div className="mb-6 rounded-xl border border-amber-700/50 bg-amber-400/5 p-4 flex gap-4">
          {selected.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.imageUrl} alt={selected.name} className="w-20 h-28 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-amber-400">{selected.name.includes(' // ') ? selected.name.split(' // ')[0] : selected.name}</span>
              <span className="text-sm">{selected.colorIdentity.map(c => COLOR_SYMBOLS[c] ?? c).join('')}</span>
            </div>
            <p className="text-xs text-zinc-500 mb-2">{selected.typeLine}</p>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{selected.oracleText}</p>
            {selected.priceUsd && (
              <p className="text-xs text-zinc-600 mt-1">${selected.priceUsd.toFixed(2)}</p>
            )}
            <div className="mt-3 pt-3 border-t border-amber-700/30">
              {commanderExplanation ? (
                <p className="text-xs text-amber-200/80 leading-relaxed">{commanderExplanation}</p>
              ) : (
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
                  Khoa is thinking about this commander…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← Back
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={onSkip} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            Skip for now
          </button>
          {selected && (
            <button
              type="button"
              onClick={() => onSelect(selected)}
              className="rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-6 py-2.5 transition-colors text-sm"
            >
              Build with {selected.name.split(',')[0]} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
