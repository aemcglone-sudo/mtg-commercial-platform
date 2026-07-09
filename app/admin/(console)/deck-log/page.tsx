'use client';

import { useEffect, useState, useCallback } from 'react';
import type { DeckLogEntry, DeckLogCard } from '@/app/api/admin/deck-log/route';
import type { DeckScore } from '@/app/api/deck-wizard/score/route';

const BASIC_LANDS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes',
  'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);

function gradeColor(pct: number) {
  if (pct >= 75) return 'text-green-400';
  if (pct >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function ScoreChip({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100;
  return (
    <span className={`text-xs font-mono font-bold ${gradeColor(pct)}`}>{score}/{max}</span>
  );
}

function CardModal({ card, onClose }: { card: DeckLogCard; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-zinc-100">{card.name}</h3>
            {card.mana_cost && <p className="text-xs text-zinc-400 mt-0.5">{card.mana_cost} · CMC {card.cmc}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none ml-3">×</button>
        </div>
        {card.image_uris?.normal && (
          <img src={card.image_uris.normal} alt={card.name} className="w-full rounded-xl mb-3" />
        )}
        {card.type_line && <p className="text-xs text-zinc-400 mb-2">{card.type_line}</p>}
        {card.scryfall_uri && (
          <a href={card.scryfall_uri} target="_blank" rel="noopener noreferrer"
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
            View on Scryfall →
          </a>
        )}
      </div>
    </div>
  );
}

function DeckDetail({ deckId, onBack }: { deckId: string; onBack: () => void }) {
  const [deck, setDeck] = useState<DeckLogEntry | null>(null);
  const [cards, setCards] = useState<DeckLogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<DeckLogCard | null>(null);

  useEffect(() => {
    fetch(`/api/admin/deck-log?deckId=${deckId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((d: { deck: DeckLogEntry; cards: DeckLogCard[] } | null) => {
        if (d) { setDeck(d.deck); setCards(d.cards); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [deckId]);

  let score: DeckScore | null = null;
  try { score = deck?.rubric_score ? JSON.parse(deck.rubric_score) : null; } catch { score = null; }
  if (score && typeof score.totalScore !== 'number') score = null;

  const nonLands = cards.filter(c => !BASIC_LANDS.has(c.name)).sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0));
  const lands = cards.filter(c => BASIC_LANDS.has(c.name));

  return (
    <div>
      {selectedCard && <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
      <button type="button" onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm mb-6 transition-colors">← Back to log</button>

      {loading && <div className="text-zinc-600 text-sm animate-pulse">Loading deck…</div>}

      {deck && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-zinc-100">{deck.name}</h2>
            <p className="text-zinc-500 text-sm mt-1">
              {deck.format} · {deck.commander ?? deck.strategy ?? 'No archetype'} · {deck.userEmail ?? deck.userId} · {new Date(deck.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Rubric scorecard */}
          {score && (
            <div className={`rounded-xl border px-5 py-4 mb-6 ${
              score.percentage >= 75 ? 'border-green-800/50 bg-green-900/5' :
              score.percentage >= 60 ? 'border-amber-700/50 bg-amber-900/5' :
              'border-red-800/50 bg-red-900/5'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Rubric Score</span>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${gradeColor(score.percentage)}`}>{score.totalScore}/{score.maxScore}</span>
                  <span className={`text-sm font-bold rounded-full px-2.5 py-0.5 ${
                    score.grade === 'A' ? 'bg-green-900/40 text-green-400' :
                    score.grade === 'B' ? 'bg-blue-900/40 text-blue-400' :
                    score.grade === 'C' ? 'bg-amber-900/40 text-amber-400' :
                    'bg-red-900/40 text-red-400'
                  }`}>{score.grade}</span>
                  <span className="text-xs text-zinc-500">{score.powerLevel.tier} · Power {score.powerLevel.score}/10</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {([
                  ['Mana Base', score.manaBase],
                  ['Structure', score.deckStructure],
                  ['Removal', score.removal],
                  ['Synergy', score.synergy],
                  ['Card Adv.', score.cardAdvantage],
                  ['Curve', score.manaCurve],
                  ['Compliance', score.formatCompliance],
                ] as [string, { score: number; max: number; notes: string }][]).map(([label, cat]) => (
                  <div key={label} className="rounded-lg bg-zinc-800/50 px-3 py-2" title={cat.notes}>
                    <ScoreChip score={cat.score} max={cat.max} />
                    <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {score.recommendations.length > 0 && (
                <div className="space-y-1.5">
                  {score.recommendations.map((rec, i) => (
                    <div key={i} className={`rounded-lg px-3 py-2 text-xs flex gap-2 ${
                      rec.priority === 'CRITICAL' ? 'bg-red-900/20 border border-red-800/40' :
                      rec.priority === 'MAJOR' ? 'bg-amber-900/20 border border-amber-800/40' :
                      'bg-zinc-800/50'
                    }`}>
                      <span className={`font-bold shrink-0 ${rec.priority === 'CRITICAL' ? 'text-red-400' : rec.priority === 'MAJOR' ? 'text-amber-400' : 'text-zinc-500'}`}>{rec.priority}</span>
                      <div><span className="text-zinc-300 font-medium">{rec.issue}</span>{rec.action && <span className="text-zinc-500"> — {rec.action}</span>}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Card list */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              Cards ({cards.reduce((s, c) => s + c.quantity, 0)} total) — click any card for details
            </div>
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 text-xs">
              {nonLands.map(card => (
                <button
                  key={card.name}
                  type="button"
                  onClick={() => setSelectedCard(card)}
                  className="flex items-center gap-1.5 py-0.5 w-full text-left hover:text-amber-400 transition-colors group"
                >
                  <span className="text-amber-400 font-mono w-4 shrink-0">{card.quantity}</span>
                  <span className="text-zinc-300 group-hover:text-amber-400 truncate">{card.name}</span>
                  {card.cmc !== undefined && <span className="text-zinc-600 shrink-0">{card.cmc}</span>}
                </button>
              ))}
              {lands.length > 0 && (
                <>
                  <div className="py-1 text-zinc-600 font-medium break-inside-avoid">— Lands —</div>
                  {lands.map(card => (
                    <button
                      key={card.name}
                      type="button"
                      onClick={() => setSelectedCard(card)}
                      className="flex items-center gap-1.5 py-0.5 w-full text-left hover:text-amber-400 transition-colors group"
                    >
                      <span className="text-amber-400 font-mono w-4 shrink-0">{card.quantity}</span>
                      <span className="text-zinc-300 group-hover:text-amber-400 truncate">{card.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DeckLogPage() {
  const [decks, setDecks] = useState<DeckLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/deck-log', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { decks: [] })
      .then((d: { decks: DeckLogEntry[] }) => setDecks(d.decks))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selectedDeckId) {
    return <DeckDetail deckId={selectedDeckId} onBack={() => setSelectedDeckId(null)} />;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Deck Log</h1>
          <p className="text-zinc-500 mt-1 text-sm">Every deck built by the wizard, with rubric scores.</p>
        </div>
        <button type="button" onClick={load} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Refresh</button>
      </div>

      {loading && <div className="text-zinc-600 text-sm animate-pulse">Loading…</div>}

      {!loading && decks.length === 0 && (
        <div className="text-zinc-600 text-sm">No decks yet.</div>
      )}

      <div className="space-y-2">
        {decks.map(deck => {
          let score: DeckScore | null = null;
          try { score = deck.rubric_score ? JSON.parse(deck.rubric_score) : null; } catch { score = null; }
          if (score && typeof score.totalScore !== 'number') score = null;
          return (
            <button
              key={deck.id}
              type="button"
              onClick={() => setSelectedDeckId(deck.id)}
              className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 px-5 py-3.5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-zinc-100 truncate">{deck.name}</span>
                    {deck.commander && (
                      <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-700/40 rounded-full px-2 py-0.5 shrink-0">
                        {deck.commander.split(',')[0]}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {deck.format} · {deck.userEmail ?? deck.userId} · {new Date(deck.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {score ? (
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${gradeColor(score.percentage)}`}>{score.totalScore}<span className="text-xs text-zinc-600">/{score.maxScore}</span></div>
                      <div className="text-[10px] text-zinc-600">{score.percentage}%</div>
                    </div>
                    <span className={`text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center ${
                      score.grade === 'A' ? 'bg-green-900/40 text-green-400' :
                      score.grade === 'B' ? 'bg-blue-900/40 text-blue-400' :
                      score.grade === 'C' ? 'bg-amber-900/40 text-amber-400' :
                      'bg-red-900/40 text-red-400'
                    }`}>{score.grade}</span>
                    <div className="hidden sm:grid grid-cols-4 gap-1">
                      {[
                        ['MB', score.manaBase, 25],
                        ['Re', score.removal, 20],
                        ['Sy', score.synergy, 25],
                        ['Dr', score.cardAdvantage, 15],
                      ].map(([label, cat, max]) => {
                        const c = cat as { score: number; max: number } | undefined;
                        const pct = c ? (c.score / (max as number)) * 100 : 0;
                        return (
                          <div key={label as string} className="text-center">
                            <div className={`text-[10px] font-bold ${gradeColor(pct)}`}>{c?.score ?? '—'}</div>
                            <div className="text-[9px] text-zinc-700">{label as string}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-700 shrink-0">No score</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
