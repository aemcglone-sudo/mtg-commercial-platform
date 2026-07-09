'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ManaChart } from './ManaChart';
import type { DeckScore } from '@/app/api/deck-wizard/score/route';

interface Violation { card: string; reason: string }
interface Combo { cards: string[]; description: string; difficulty: string; type: string }
interface Synergy { cards: string[]; description: string }

interface Props {
  sessionId: string | null;
  format: string;
  commander: string | null;
  commanderColorIdentity: string[];
  cards: Record<string, number>;
  archetype: string | null;
  themes: string[];
  tribalType?: string | null;
  psychographic?: string | null;
  budgetCents: number | null;
  ownedCardNames?: string[];
  collectionOnly?: boolean;
  roleTargets?: Record<string, number> | null;
  deckColors?: string[];
  onBack: () => void;
}

const BASIC_LANDS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes',
  'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);

const DEFAULT_NAME = (commander: string | null, format: string) => {
  if (commander) return `${commander.split(',')[0]}'s Deck`;
  const fmt = format?.trim() || 'Commander';
  return `My ${fmt.charAt(0).toUpperCase() + fmt.slice(1)} Deck`;
};


export function DeckReview({ sessionId, format, commander, commanderColorIdentity, cards, archetype, themes, tribalType, psychographic, budgetCents, ownedCardNames = [], collectionOnly = false, roleTargets = null, deckColors = [], onBack }: Props) {
  const router = useRouter();
  const [localCards, setLocalCards] = useState<Record<string, number>>(cards);
  const [deckName, setDeckName] = useState('');
  const [nameGenerating, setNameGenerating] = useState(true);
  const [cmcMap, setCmcMap] = useState<Record<string, number>>({});
  const [violations, setViolations] = useState<Violation[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [synergies, setSynergies] = useState<Synergy[]>([]);
  const [winCondition, setWinCondition] = useState<string | null>(null);
  const [deckScore, setDeckScore] = useState<DeckScore | null>(null);
  const [scoring, setScoring] = useState(true);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [overrideLegal, setOverrideLegal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateName() {
    setNameGenerating(true);
    try {
      const res = await fetch('/api/deck-wizard/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commander, format, archetype, themes, tribalType, psychographic }),
      });
      const data = await res.json() as { name: string | null };
      if (data.name && data.name.trim().length > 2) {
        setDeckName(data.name.trim());
      } else {
        setDeckName(DEFAULT_NAME(commander, format));
      }
    } catch {
      setDeckName(DEFAULT_NAME(commander, format));
    }
    setNameGenerating(false);
  }

  const cardEntries = Object.entries(localCards);
  const totalCards = cardEntries.reduce((s, [, q]) => s + q, 0);
  const nonLandCards = cardEntries.filter(([n]) => !BASIC_LANDS.has(n));

  const validate = useCallback(async (currentCards: Record<string, number>) => {
    setValidating(true);
    setScoring(true);
    const entries = Object.entries(currentCards);
    try {
      const [validRes, combosRes, scoreRes] = await Promise.all([
        fetch('/api/deck-wizard/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: entries.map(([name, quantity]) => ({ name, quantity })), format, commanderColorIdentity }),
        }),
        fetch('/api/deck-wizard/detect-combos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: entries.map(([name]) => name), commander, format }),
        }),
        fetch('/api/deck-wizard/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: currentCards, commander, commanderColorIdentity, format, archetype, themes, tribalType }),
        }),
      ]);

      const validData = await validRes.json() as { violations: Violation[] };
      const combosData = await combosRes.json() as { combos: Combo[]; synergies: Synergy[]; winCondition?: string | null };
      const scoreData = await scoreRes.json() as DeckScore;

      setViolations(validData.violations ?? []);
      setCombos(combosData.combos ?? []);
      setSynergies(combosData.synergies ?? []);
      setWinCondition(combosData.winCondition ?? null);
      if (scoreRes.ok) {
        setDeckScore(scoreData);
        return scoreData;
      }
      return null;
    } catch {
      setViolations([]);
      return null;
    } finally {
      setValidating(false);
      setScoring(false);
    }
  }, [format, commanderColorIdentity]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    validate(cards);
    generateName();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cmc for mana curve — update when localCards changes
  useEffect(() => {
    const nonLandNames = Object.keys(localCards).filter(n => !BASIC_LANDS.has(n));
    if (nonLandNames.length === 0) return;

    // Scryfall /cards/collection accepts up to 75 cards
    const chunks: string[][] = [];
    for (let i = 0; i < nonLandNames.length; i += 75) chunks.push(nonLandNames.slice(i, i + 75));

    Promise.all(
      chunks.map(chunk =>
        fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
        })
          .then(r => r.ok ? r.json() : { data: [] })
          .then((d: { data: Array<{ name: string; cmc: number }> }) => d.data ?? [])
      )
    ).then(results => {
      const map: Record<string, number> = {};
      for (const batch of results) {
        for (const card of batch) map[card.name] = card.cmc ?? 0;
      }
      setCmcMap(map);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!deckName.trim()) { setError('Please enter a deck name.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/deck-wizard/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, deckName, cards: localCards, commander, format, archetype, rubricScore: deckScore ?? undefined }),
      });
      const data = await res.json() as { deckId: string; ok: boolean; error?: string };
      if (!data.ok) { setError(data.error ?? 'Failed to save'); return; }
      setSaved(true);
      setTimeout(() => router.push('/?tab=mydecks'), 1500);
    } catch {
      setError('Failed to save deck. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const isLegal = violations.length === 0;
  const canSave = (isLegal || overrideLegal) && deckName.trim().length > 0 && !scoring;

  // Group by role (lands vs non-lands)
  const lands = cardEntries.filter(([n]) => BASIC_LANDS.has(n));
  const nonLands = cardEntries.filter(([n]) => !BASIC_LANDS.has(n));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-100 mb-1">Review Your Deck</h2>
        <p className="text-zinc-500 text-sm">
          {totalCards} cards · {format} · {archetype ?? 'No archetype'} · {themes.length > 0 ? themes.join(', ') : 'No themes'}
          {budgetCents ? ` · $${(budgetCents / 100).toFixed(0)} budget` : ''}
        </p>
      </div>

      {/* Deck name */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="deck-name" className="text-xs font-medium text-zinc-500">Deck Name</label>
          <button
            type="button"
            onClick={generateName}
            disabled={nameGenerating}
            className="text-xs text-amber-500 hover:text-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {nameGenerating ? 'Generating…' : '✦ Suggest another name'}
          </button>
        </div>
        <input
          id="deck-name"
          type="text"
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          placeholder={nameGenerating ? 'Generating a name…' : 'Name your deck'}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-600 transition-colors"
        />
        <p className="text-xs text-zinc-600 mt-1">Khoa named this based on your commander and strategy — change it to whatever you like.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className={`text-2xl font-bold ${totalCards === 100 || totalCards === 60 ? 'text-green-400' : 'text-amber-400'}`}>{totalCards}</div>
          <div className="text-xs text-zinc-600 mt-0.5">Cards</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className="text-2xl font-bold text-zinc-200">{nonLandCards.length}</div>
          <div className="text-xs text-zinc-600 mt-0.5">Non-Lands</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className="text-2xl font-bold text-zinc-200">{lands.reduce((s, [, q]) => s + q, 0)}</div>
          <div className="text-xs text-zinc-600 mt-0.5">Lands</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className={`text-2xl font-bold ${isLegal ? 'text-green-400' : 'text-red-400'}`}>
            {validating ? '…' : isLegal ? '✓' : violations.length}
          </div>
          <div className="text-xs text-zinc-600 mt-0.5">{isLegal ? 'Legal' : 'Violations'}</div>
        </div>
      </div>

      {/* Win condition */}
      {(winCondition || validating) && (
        <div className="rounded-xl border border-amber-600/40 bg-amber-400/5 px-5 py-4 mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-amber-400">⚡</span>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Win Condition</span>
          </div>
          {winCondition
            ? <p className="text-sm text-amber-100 leading-relaxed">{winCondition}</p>
            : <div className="h-4 bg-amber-400/10 rounded animate-pulse w-3/4" />
          }
        </div>
      )}

      {/* Deck Score */}
      {(scoring || deckScore) && (
        <div className={`rounded-xl border px-5 py-4 mb-6 ${
          scoring ? 'border-zinc-800 bg-zinc-900' :
          deckScore!.percentage >= 75 ? 'border-green-800/50 bg-green-900/5' :
          deckScore!.percentage >= 60 ? 'border-amber-700/50 bg-amber-900/5' :
          'border-red-800/50 bg-red-900/5'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Deck Score</span>
              {scoring && <span className="text-xs text-zinc-600 animate-pulse">Evaluating…</span>}
            </div>
            {deckScore && !scoring && (
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${deckScore.percentage >= 75 ? 'text-green-400' : deckScore.percentage >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                  {deckScore.totalScore}/{deckScore.maxScore}
                </span>
                <span className={`text-sm font-bold rounded-full px-2.5 py-0.5 ${
                  deckScore.grade === 'A' ? 'bg-green-900/40 text-green-400' :
                  deckScore.grade === 'B' ? 'bg-blue-900/40 text-blue-400' :
                  deckScore.grade === 'C' ? 'bg-amber-900/40 text-amber-400' :
                  'bg-red-900/40 text-red-400'
                }`}>{deckScore.grade}</span>
                <span className="text-xs text-zinc-500">{deckScore.powerLevel.tier} · Power {deckScore.powerLevel.score}/10</span>
              </div>
            )}
          </div>

          {deckScore && !scoring && (
            <>
              {/* Category grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  deckScore.manaBase,
                  deckScore.deckStructure,
                  deckScore.removal,
                  deckScore.synergy,
                  deckScore.cardAdvantage,
                  deckScore.manaCurve,
                  deckScore.formatCompliance,
                ].map((cat) => {
                  const pct = cat.score / cat.max;
                  const color = pct >= 0.75 ? 'text-green-400' : pct >= 0.55 ? 'text-amber-400' : 'text-red-400';
                  return (
                    <div key={cat.label} className="rounded-lg bg-zinc-800/50 px-3 py-2" title={cat.notes}>
                      <div className={`text-sm font-bold ${color}`}>{cat.score}/{cat.max}</div>
                      <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{cat.label}</div>
                    </div>
                  );
                })}
                {/* Validity */}
                <div className="rounded-lg bg-zinc-800/50 px-3 py-2" title={deckScore.validity.notes}>
                  <div className={`text-sm font-bold ${deckScore.validity.pass ? 'text-green-400' : 'text-red-400'}`}>
                    {deckScore.validity.pass ? '✓' : '✗'}
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">Validity</div>
                </div>
              </div>

              {/* Recommendations */}
              {deckScore.recommendations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Recommendations</div>
                  {deckScore.recommendations.map((rec, i) => (
                    <div key={i} className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${
                      rec.priority === 'CRITICAL' ? 'bg-red-900/20 border border-red-800/40' :
                      rec.priority === 'MAJOR' ? 'bg-amber-900/20 border border-amber-800/40' :
                      'bg-zinc-800/50'
                    }`}>
                      <span className={`font-bold shrink-0 ${
                        rec.priority === 'CRITICAL' ? 'text-red-400' :
                        rec.priority === 'MAJOR' ? 'text-amber-400' :
                        'text-zinc-500'
                      }`}>{rec.priority}</span>
                      <div>
                        <span className="text-zinc-300 font-medium">{rec.issue}</span>
                        {rec.action && <span className="text-zinc-500"> — {rec.action}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </>
          )}
        </div>
      )}

      {/* Mana chart */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 mb-6">
        <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Mana Curve</div>
        {nonLands.length > 0 && nonLands.every(([name]) => !(name in cmcMap)) ? (
          <div className="text-xs text-zinc-600 text-center py-4 animate-pulse">Fetching card data…</div>
        ) : (
          <ManaChart cards={nonLands.map(([name, quantity]) => ({ quantity, cmc: cmcMap[name] ?? 0 }))} />
        )}
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="rounded-xl border border-red-800 bg-red-900/10 p-4 mb-6">
          <div className="font-semibold text-red-400 text-sm mb-2">Legality Issues</div>
          <div className="space-y-1">
            {violations.map((v, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-300">
                <span className="shrink-0">•</span>
                <span><strong>{v.card}</strong>: {v.reason}</span>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-3 text-xs text-zinc-500 cursor-pointer">
            <input type="checkbox" checked={overrideLegal} onChange={e => setOverrideLegal(e.target.checked)} className="rounded" />
            Save anyway (casual / work in progress)
          </label>
        </div>
      )}

      {/* Combos */}
      {combos.length > 0 && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 mb-6">
          <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Combos Found</div>
          <div className="space-y-3">
            {combos.map((combo, i) => (
              <div key={i} className="rounded-lg bg-zinc-800 p-3">
                <div className="flex flex-wrap gap-1 mb-1">
                  {combo.cards.map(c => (
                    <span key={c} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-800 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{combo.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synergies */}
      {synergies.length > 0 && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 mb-6">
          <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Key Synergies</div>
          <div className="space-y-2">
            {synergies.map((syn, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-zinc-600 shrink-0">•</span>
                <div>
                  <span className="text-zinc-300">{syn.cards.join(' + ')}</span>
                  <span className="text-zinc-500"> — {syn.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full card list */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 mb-6">
        <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Full Card List</div>
        <div className="columns-2 sm:columns-3 gap-4 text-xs">
          {nonLands.sort(([a], [b]) => a.localeCompare(b)).map(([name, qty]) => (
            <div key={name} className="flex items-center gap-1 py-0.5">
              <span className="text-amber-400 font-mono w-4 shrink-0">{qty}</span>
              <span className="text-zinc-400">{name}</span>
            </div>
          ))}
          {lands.length > 0 && (
            <>
              <div className="break-inside-avoid pt-2 pb-1 text-zinc-600 font-medium">— Lands —</div>
              {lands.sort(([a], [b]) => a.localeCompare(b)).map(([name, qty]) => (
                <div key={name} className="flex items-center gap-1 py-0.5">
                  <span className="text-amber-400 font-mono w-4 shrink-0">{qty}</span>
                  <span className="text-zinc-400">{name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {totalCards < 10 && (
        <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-3 text-amber-400 text-sm mb-4">
          ⚠️ Your deck only has {totalCards} card{totalCards !== 1 ? 's' : ''}. Go back to the card selection step and use <strong>+ Add All Suggestions</strong> or click <strong>+</strong> on individual cards to build out your deck.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-3 text-red-400 text-sm mb-4">{error}</div>
      )}

      {saved && (
        <div className="rounded-xl border border-green-800 bg-green-900/20 p-3 text-green-400 text-sm mb-4">
          ✓ Deck saved! Redirecting to your decks…
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← Back to Cards
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave || saving || saved}
          className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-bold px-8 py-3 transition-colors"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Deck'}
        </button>
      </div>
    </div>
  );
}
