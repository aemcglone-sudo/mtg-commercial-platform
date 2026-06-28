'use client';

import { useState } from 'react';

const PRESETS = [
  { label: 'Pauper', cents: 1000, description: 'Under $10 — budget commons and uncommons' },
  { label: 'Budget', cents: 5000, description: 'Under $50 — no expensive staples' },
  { label: 'Optimized', cents: 15000, description: 'Under $150 — most staples accessible' },
  { label: 'Competitive', cents: 30000, description: 'Under $300 — near-optimal builds' },
  { label: 'No Limit', cents: null, description: 'Any price — full power' },
];

interface Props {
  selected: number | null;
  onSelect: (budgetCents: number | null) => void;
  onBack: () => void;
}

export function BudgetSelector({ selected, onSelect, onBack }: Props) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  function handleCustom() {
    const val = parseFloat(custom);
    if (!isNaN(val) && val > 0) {
      onSelect(Math.round(val * 100));
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Set Your Budget</h2>
        <p className="text-zinc-500">Khoa will prioritize suggestions that fit your budget and flag expensive alternatives.</p>
      </div>

      <div className="space-y-2 mb-4">
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => { onSelect(p.cents); setShowCustom(false); }}
            className={`w-full text-left rounded-xl border p-4 transition-all flex items-center justify-between ${
              selected === p.cents && !showCustom
                ? 'bg-amber-400/10 border-amber-500'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
            }`}
          >
            <div>
              <span className={`font-semibold text-sm ${selected === p.cents && !showCustom ? 'text-amber-400' : 'text-zinc-200'}`}>
                {p.label}
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">{p.description}</p>
            </div>
            {p.cents !== null && (
              <span className="text-sm font-mono text-zinc-500">${(p.cents / 100).toFixed(0)}</span>
            )}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowCustom(v => !v)}
          className={`w-full text-left rounded-xl border p-4 transition-all ${
            showCustom ? 'bg-amber-400/10 border-amber-500' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
          }`}
        >
          <span className={`font-semibold text-sm ${showCustom ? 'text-amber-400' : 'text-zinc-200'}`}>Custom Amount</span>
        </button>
      </div>

      {showCustom && (
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <span className="absolute left-3 top-3 text-zinc-500">$</span>
            <input
              type="number"
              min="1"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="75"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-7 pr-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-600"
            />
          </div>
          <button
            type="button"
            onClick={handleCustom}
            disabled={!custom || isNaN(parseFloat(custom))}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold px-4 py-2.5 text-sm transition-colors"
          >
            Set
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← Back
        </button>
        <button
          type="button"
          onClick={() => onSelect(selected)}
          className="rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-6 py-2.5 transition-colors text-sm"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
