'use client';

import { useEffect, useState } from 'react';

interface FormatInfo {
  id: string;
  label: string;
  category: string;
  deckSize: number;
  singleton: boolean;
  popular: boolean;
  description: string;
}

interface Props {
  selected: string;
  collectionOnly: boolean;
  onSelect: (format: string) => void;
  onNaturalLanguage: () => void;
  onToggleCollectionOnly: (value: boolean) => void;
}

const CATEGORY_ORDER = ['constructed', 'commander', 'limited', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  constructed: 'Constructed',
  commander: 'Commander & Variants',
  limited: 'Limited',
  other: 'Specialty',
};

export function FormatSelector({ selected, collectionOnly, onSelect, onNaturalLanguage, onToggleCollectionOnly }: Props) {
  const [formats, setFormats] = useState<FormatInfo[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/deck-wizard/formats')
      .then(r => r.json())
      .then((data: { formats: FormatInfo[] }) => setFormats(data.formats))
      .catch(() => {});
  }, []);

  const byCategory = CATEGORY_ORDER.reduce<Record<string, FormatInfo[]>>((acc, cat) => {
    acc[cat] = formats.filter(f => f.category === cat);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Choose Your Format</h2>
        <p className="text-zinc-500">Select the format you want to build for, or describe your deck in natural language.</p>
      </div>

      <div className="flex gap-3 mb-8">
        <button
          type="button"
          onClick={onNaturalLanguage}
          className="flex-1 rounded-xl border border-dashed border-amber-700/50 bg-amber-400/5 hover:bg-amber-400/10 hover:border-amber-600 p-4 text-left transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <div className="font-semibold text-amber-400 group-hover:text-amber-300">Natural Language</div>
              <div className="text-sm text-zinc-500">Describe your deck idea and let Khoa configure everything</div>
            </div>
            <span className="ml-auto text-zinc-600 group-hover:text-zinc-400">→</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onToggleCollectionOnly(!collectionOnly)}
          className={`rounded-xl border p-4 text-left transition-all min-w-48 ${
            collectionOnly
              ? 'bg-green-900/30 border-green-600 text-green-400'
              : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{collectionOnly ? '✅' : '📦'}</span>
            <div>
              <div className="font-semibold text-sm">From My Collection</div>
              <div className="text-xs text-zinc-500 mt-0.5">Only use cards you own</div>
            </div>
          </div>
        </button>
      </div>

      <div className="space-y-6">
        {CATEGORY_ORDER.filter(cat => (byCategory[cat]?.length ?? 0) > 0).map(cat => (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">{CATEGORY_LABELS[cat]}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(byCategory[cat] ?? []).map(fmt => (
                <div key={fmt.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (expanded === fmt.id) {
                        onSelect(fmt.id);
                      } else {
                        setExpanded(fmt.id);
                      }
                    }}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      selected === fmt.id
                        ? 'bg-amber-400/10 border-amber-500'
                        : expanded === fmt.id
                          ? 'bg-zinc-800 border-zinc-600'
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${selected === fmt.id ? 'text-amber-400' : 'text-zinc-200'}`}>
                          {fmt.label}
                        </span>
                        {fmt.popular && <span className="text-[10px] bg-blue-900/40 text-blue-400 border border-blue-800 px-1.5 py-0.5 rounded font-medium">Popular</span>}
                      </div>
                      <span className="text-xs text-zinc-600">{fmt.deckSize} cards</span>
                    </div>
                    {expanded === fmt.id && (
                      <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{fmt.description}</p>
                    )}
                  </button>
                  {expanded === fmt.id && selected !== fmt.id && (
                    <button
                      type="button"
                      onClick={() => onSelect(fmt.id)}
                      className="w-full mt-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold text-sm py-2 transition-colors"
                    >
                      Select {fmt.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => onSelect(selected)}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-6 py-2.5 transition-colors"
          >
            Continue with {formats.find(f => f.id === selected)?.label ?? selected} →
          </button>
        </div>
      )}
    </div>
  );
}
