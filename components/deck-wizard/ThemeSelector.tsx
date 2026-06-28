'use client';

import { useEffect, useState } from 'react';
import { ThemeTile } from './ThemeTile';

interface ThemeItem {
  id: string;
  label: string;
  description: string;
  colors?: string[];
  difficulty?: string;
}

interface ThemeData {
  archetypes: ThemeItem[];
  strategyThemes: ThemeItem[];
  namedArchetypes: ThemeItem[];
  tribalThemes: ThemeItem[];
  psychographics: Array<{ id: string; label: string; description: string }>;
}

interface RoleTargets {
  ramp: number; card_draw: number; removal: number;
  board_wipes?: number; win_conditions: number; theme_pieces: number; lands: number;
}

interface Props {
  format: string;
  commanderName: string | null;
  selectedThemes: string[];
  selectedArchetype: string | null;
  tribalType: string | null;
  recommendations: Recommendations | null;
  onConfirm: (themes: string[], tribalType: string | null, psychographic: string | null, roleTargets: RoleTargets | null) => void;
  onBack: () => void;
}

interface Recommendations {
  themes: string[];
  archetypes: string[];
  tribal: string[];
  psychographics: string[];
}

export function ThemeSelector({ format, commanderName, selectedThemes, selectedArchetype, tribalType, recommendations: recsProp, onConfirm, onBack }: Props) {
  const [data, setData] = useState<ThemeData | null>(null);
  const [themes, setThemes] = useState<string[]>(selectedThemes);
  const [tribal, setTribal] = useState<string | null>(tribalType);
  const [psychographic, setPsychographic] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [conflicts, setConflicts] = useState<Array<{ themes: string[]; message: string }>>([]);
  const [localRecs, setLocalRecs] = useState<(Recommendations & { whyThese?: string }) | null>(recsProp);

  // Use prop if provided, otherwise fall back to locally-fetched recs
  const recommendations = localRecs;

  useEffect(() => {
    fetch('/api/deck-wizard/themes')
      .then(r => r.json())
      .then((d: ThemeData) => setData(d))
      .catch(() => {});
  }, []);

  // Fetch recommendations internally — archetype path is instant static lookup (~70ms)
  useEffect(() => {
    if (localRecs) return; // already have recs from parent
    const param = selectedArchetype
      ? `archetype=${encodeURIComponent(selectedArchetype)}&format=${encodeURIComponent(format)}`
      : commanderName
        ? `commander=${encodeURIComponent(commanderName)}&format=${encodeURIComponent(format)}`
        : null;
    if (!param) return;
    fetch(`/api/deck-wizard/themes/recommend?${param}`)
      .then(r => r.ok ? r.json() : null)
      .then((recs: (Recommendations & { whyThese?: string }) | null) => {
        if (recs?.themes?.length || recs?.psychographics?.length) setLocalRecs(recs);
      })
      .catch(() => {});
  }, [selectedArchetype, commanderName, format]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recommendations?.psychographics?.[0] && !psychographic) {
      setPsychographic(recommendations.psychographics[0]);
    }
    if ((recommendations as any)?.tribal?.[0] && !tribal) {
      setTribal((recommendations as any).tribal[0]);
    }
  }, [recommendations]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTheme(id: string) {
    setThemes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  function handleConfirm() {
    // Navigate immediately — resolve-themes runs in background and conflicts are non-blocking
    onConfirm(themes, tribal, psychographic, null);
    // Fire-and-forget conflict detection (result is informational only)
    fetch('/api/deck-wizard/resolve-themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themes, archetypes: selectedArchetype ? [selectedArchetype] : [], tribalType: tribal, format, commander: commanderName }),
    }).catch(() => {});
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-zinc-600 text-sm">Loading themes…</div>
      </div>
    );
  }

  const isRec = (section: keyof Recommendations, id: string) =>
    !!recommendations?.[section]?.some((r: string) => r.toLowerCase() === id.toLowerCase());

  const whyThese = (recommendations as (Recommendations & { whyThese?: string | null }) | null)?.whyThese ?? null;

  return (
    <div className="max-w-6xl mx-auto flex gap-6 items-start">
      {/* Main column */}
      <div className="flex-1 min-w-0">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Choose Your Themes</h2>
        <p className="text-zinc-500">Mix and match themes to define your deck's identity. Pick 1–3 for best results.</p>
      </div>

      {recommendations && (
        <div className="mb-6 rounded-xl border border-amber-700/40 bg-amber-400/5 px-4 py-3 flex items-center gap-2 text-sm">
          <span className="text-amber-400">✦</span>
          <span className="text-amber-300 font-medium">Highlighted options are recommended for {commanderName ? commanderName.split(',')[0] : selectedArchetype}</span>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mb-6 space-y-2">
          {conflicts.map((c, i) => (
            <div key={i} className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-300">
              <span className="font-semibold">⚠️ Conflict: </span>{c.message}
              <button type="button" onClick={() => setConflicts(prev => prev.filter((_, j) => j !== i))}
                className="ml-auto float-right text-amber-500 hover:text-amber-300">Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* Strategy themes */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Strategy Themes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.strategyThemes.map(t => (
            <ThemeTile
              key={t.id}
              id={t.id}
              label={t.label}
              description={t.description}
              colors={t.colors}
              difficulty={t.difficulty}
              selected={themes.includes(t.id)}
              recommended={isRec('themes', t.id)}
              onClick={() => toggleTheme(t.id)}
            />
          ))}
        </div>
      </div>

      {/* Named archetypes — only show for Commander where no broad archetype was pre-selected */}
      {!selectedArchetype && (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Popular Deck Builds</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.namedArchetypes.map(t => (
            <ThemeTile
              key={t.id}
              id={t.id}
              label={t.label}
              description={t.description}
              colors={t.colors}
              difficulty={t.difficulty}
              selected={themes.includes(t.id)}
              recommended={isRec('archetypes', t.id)}
              onClick={() => toggleTheme(t.id)}
            />
          ))}
        </div>
      </div>
      )}

      {/* Tribal */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Tribal Focus (optional)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {data.tribalThemes.map(t => {
            const recTribal = isRec('tribal', t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTribal(prev => prev === t.id ? null : t.id)}
                className={`rounded-xl border p-2 text-xs font-medium transition-all ${
                  tribal === t.id
                    ? 'bg-amber-400/10 border-amber-500 text-amber-400'
                    : recTribal
                      ? 'bg-amber-400/5 border-amber-700/60 text-amber-200 hover:border-amber-500'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {recTribal && tribal !== t.id && <span className="mr-1 text-amber-500">✦</span>}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Psychographic */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Play Style (optional)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {data.psychographics.map(p => {
            const recPsycho = isRec('psychographics', p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPsychographic(prev => prev === p.id ? null : p.id)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  psychographic === p.id
                    ? 'bg-amber-400/10 border-amber-500'
                    : recPsycho
                      ? 'bg-amber-400/5 border-amber-700/60 hover:border-amber-500'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {recPsycho && psychographic !== p.id && <span className="text-amber-500 text-xs">✦</span>}
                  <div className={`font-semibold text-sm ${psychographic === p.id ? 'text-amber-400' : recPsycho ? 'text-amber-200' : 'text-zinc-200'}`}>{p.label}</div>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← Back
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={resolving}
          className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold px-6 py-2.5 transition-colors text-sm"
        >
          {resolving ? 'Building deck…' : `Continue${themes.length > 0 ? ` with ${themes.length} theme${themes.length > 1 ? 's' : ''}` : ''} →`}
        </button>
      </div>
      </div>{/* end main column */}

      {/* Sidebar — Khoa's explanation */}
      {(commanderName || selectedArchetype) && (
        <div className="w-64 shrink-0 hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-400 text-xs">✦</span>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Khoa's Take</span>
            </div>
            <p className="text-xs font-semibold text-amber-300 mb-2">{commanderName ? commanderName.split(',')[0] : selectedArchetype}</p>
            {whyThese ? (
              <p className="text-xs text-zinc-400 leading-relaxed">{whyThese}</p>
            ) : (
              <div className="space-y-2">
                <div className="h-3 bg-zinc-800 rounded animate-pulse w-full" />
                <div className="h-3 bg-zinc-800 rounded animate-pulse w-5/6" />
                <div className="h-3 bg-zinc-800 rounded animate-pulse w-4/6" />
              </div>
            )}
            {recommendations && (
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <p className="text-xs text-zinc-600 mb-2">Recommended for you</p>
                <div className="flex flex-wrap gap-1">
                  {[...recommendations.themes, ...recommendations.tribal].map(id => (
                    <span key={id} className="text-[10px] bg-amber-400/10 text-amber-400 border border-amber-700/40 rounded-full px-2 py-0.5">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
