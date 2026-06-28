'use client';

import { useEffect, useState } from 'react';

interface Archetype {
  id: string;
  label: string;
  icon: string;
  description: string;
  playstyle: string;
  difficulty: string;
}

interface Props {
  selected: string | null;
  onSelect: (archetype: string) => void;
  onBack: () => void;
}

export function ArchetypeSelector({ selected, onSelect, onBack }: Props) {
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);

  useEffect(() => {
    fetch('/api/deck-wizard/themes')
      .then(r => r.json())
      .then((data: { archetypes: Archetype[] }) => setArchetypes(data.archetypes))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Choose Your Archetype</h2>
        <p className="text-zinc-500">What's the overall game plan for your deck?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {archetypes.map(arch => (
          <button
            key={arch.id}
            type="button"
            onClick={() => onSelect(arch.id)}
            className={`text-left rounded-xl border p-4 transition-all ${
              selected === arch.id
                ? 'bg-amber-400/10 border-amber-500'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{arch.icon}</span>
              <span className={`font-bold text-sm ${selected === arch.id ? 'text-amber-400' : 'text-zinc-200'}`}>
                {arch.label}
              </span>
              <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                arch.difficulty === 'beginner' ? 'bg-green-900/40 text-green-400 border border-green-800' :
                arch.difficulty === 'intermediate' ? 'bg-amber-900/40 text-amber-400 border border-amber-800' :
                'bg-red-900/40 text-red-400 border border-red-800'
              }`}>
                {arch.difficulty}
              </span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed mb-1">{arch.description}</p>
            <p className="text-xs text-zinc-500 italic">{arch.playstyle}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← Back
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(selected)}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-6 py-2.5 transition-colors"
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
