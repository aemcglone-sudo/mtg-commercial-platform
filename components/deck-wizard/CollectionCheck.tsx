'use client';

import { useState, useEffect } from 'react';

interface CollectionCard { cardName: string; quantity: number }

interface Props {
  sessionId: string | null;
  format: string;
  commanderName: string | null;
  themes: string[];
  archetype: string | null;
  onConfirm: (ownedCardNames: string[]) => void;
  onBack: () => void;
}

export function CollectionCheck({ sessionId, format, commanderName, themes, archetype, onConfirm, onBack }: Props) {
  const [collection, setCollection] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/collection/saved')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { cards?: CollectionCard[] }) => {
        setCollection(data.cards ?? []);
      })
      .catch(() => setError('Could not load collection'))
      .finally(() => setLoading(false));
  }, []);

  const ownedNames = collection.map(c => c.cardName);
  const totalCards = collection.length;

  function handleConfirm() {
    onConfirm(ownedNames);
  }

  function handleSkip() {
    onConfirm([]);
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="text-zinc-600 text-sm">Loading your collection…</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Collection Check</h2>
        <p className="text-zinc-500">Khoa will mark which suggested cards you already own.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-4 text-red-400 text-sm mb-6">
          {error} — you can continue without collection data.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-amber-400">{totalCards}</div>
            <div>
              <div className="font-semibold text-zinc-200">Cards in Your Collection</div>
              <div className="text-sm text-zinc-500">Khoa will prioritize cards you already own</div>
            </div>
          </div>

          {commanderName && (
            <div className={`mt-4 text-sm rounded-lg p-3 ${
              ownedNames.includes(commanderName)
                ? 'bg-green-900/20 border border-green-800 text-green-400'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-500'
            }`}>
              {ownedNames.includes(commanderName) ? '✓ You own ' : '✗ You don\'t own '}<strong>{commanderName}</strong>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-zinc-800 p-3">
              <div className="text-xl font-bold text-zinc-200">{totalCards}</div>
              <div className="text-xs text-zinc-600 mt-0.5">Unique cards</div>
            </div>
            <div className="rounded-lg bg-zinc-800 p-3">
              <div className="text-xl font-bold text-zinc-200">{collection.reduce((s, c) => s + (c.quantity ?? 1), 0)}</div>
              <div className="text-xs text-zinc-600 mt-0.5">Total copies</div>
            </div>
            <div className="rounded-lg bg-zinc-800 p-3">
              <div className="text-xl font-bold text-amber-400">{totalCards > 0 ? '✓' : '—'}</div>
              <div className="text-xs text-zinc-600 mt-0.5">Ready to use</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← Back
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={handleSkip} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            Skip
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-6 py-2.5 transition-colors text-sm"
          >
            {totalCards > 0 ? `Use My Collection (${totalCards} cards) →` : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
