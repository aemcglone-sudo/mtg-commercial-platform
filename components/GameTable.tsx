'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { TableHandoff, TableCardInfo } from '@/lib/game-table-types';
import { TABLE_STATE_KEY } from '@/lib/game-table-types';
import { groupByLane, type Lane } from '@/lib/battlefield-lanes';
import type { CardSearchOption } from '@/app/api/simulator/card-search/route';

type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';
const PHASES: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];
const PHASE_LABELS: Record<Phase, string> = {
  untap: 'Untap', upkeep: 'Upkeep', draw: 'Draw', main1: 'Main Phase 1',
  combat: 'Combat', main2: 'Main Phase 2', end: 'End Step',
};

interface BattlefieldCard { id: string; name: string; tapped: boolean; }
interface OpponentChip { id: string; name: string; imageUrl: string | null; typeLine: string | null; }
type ThreatLevel = 'safe' | 'building' | 'lethal';

interface YourSeatState {
  life: number;
  hand: string[];
  battlefield: BattlefieldCard[];
  graveyard: string[];
  exile: string[];
  library: string[];
  landPlayedThisTurn: boolean;
  commanderInZone: boolean;
  commanderCastCount: number;
}

interface OpponentSeatState {
  name: string;
  life: number;
  chips: OpponentChip[];
  handCount: number;
  threat: ThreatLevel;
}

interface TableState {
  turnNumber: number;
  activeSeatIndex: number; // 0 = you, 1-3 = opponents[0..2]
  phase: Phase;
  you: YourSeatState;
  opponents: OpponentSeatState[];
}

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function makeInitialState(handoff: TableHandoff): TableState {
  return {
    turnNumber: 1,
    activeSeatIndex: 0,
    phase: 'untap',
    you: {
      life: 40,
      hand: handoff.hand,
      battlefield: [],
      graveyard: [],
      exile: [],
      library: handoff.library,
      landPlayedThisTurn: false,
      commanderInZone: !!handoff.commander,
      commanderCastCount: 0,
    },
    opponents: [
      { name: 'Opponent 1', life: 40, chips: [], handCount: 7, threat: 'safe' },
      { name: 'Opponent 2', life: 40, chips: [], handCount: 7, threat: 'safe' },
      { name: 'Opponent 3', life: 40, chips: [], handCount: 7, threat: 'safe' },
    ],
  };
}

const THREAT_STYLES: Record<ThreatLevel, { label: string; className: string }> = {
  safe: { label: 'No threat', className: 'bg-green-950/50 text-green-400' },
  building: { label: 'Building up', className: 'bg-amber-950/50 text-amber-400' },
  lethal: { label: 'Can attack for lethal', className: 'bg-red-950/50 text-red-400' },
};
const THREAT_ORDER: ThreatLevel[] = ['safe', 'building', 'lethal'];

// Migrates game state saved before opponent chips carried real card data
// (plain strings) to the current shape, so a resume doesn't crash.
function migrateState(raw: any): TableState {
  if (raw?.opponents) {
    raw.opponents = raw.opponents.map((o: any) => ({
      ...o,
      chips: (o.chips ?? []).map((c: any) =>
        typeof c === 'string' ? { id: uid(), name: c, imageUrl: null, typeLine: null } : c
      ),
    }));
  }
  return raw as TableState;
}

export default function GameTable({ handoff, onExit }: { handoff: TableHandoff; onExit: () => void }) {
  const [state, setState] = useState<TableState>(() => {
    try {
      const saved = localStorage.getItem(TABLE_STATE_KEY);
      if (saved) return migrateState(JSON.parse(saved));
    } catch { /* ignore */ }
    return makeInitialState(handoff);
  });

  useEffect(() => {
    try { localStorage.setItem(TABLE_STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const [compact, setCompact] = useState(false);
  const [handCollapsed, setHandCollapsed] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<{ name: string; imageUrl: string | null } | null>(null);
  const [justPlayedId, setJustPlayedId] = useState<string | null>(null);

  const cardInfo = useCallback((name: string): TableCardInfo | undefined => handoff.cardData[name.toLowerCase()], [handoff.cardData]);
  const commanderInfo = handoff.commander ? cardInfo(handoff.commander) : undefined;

  function fallbackImg(name: string) {
    return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  }

  // ── Turn / phase ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.activeSeatIndex !== 0) return;
    if (state.phase === 'untap') {
      setState(s => ({
        ...s,
        you: { ...s.you, battlefield: s.you.battlefield.map(c => ({ ...c, tapped: false })), landPlayedThisTurn: false },
      }));
    }
    if (state.phase === 'draw' && !(state.turnNumber === 1 && state.activeSeatIndex === 0)) {
      setState(s => {
        if (s.you.library.length === 0) return s;
        const [drawn, ...rest] = s.you.library;
        return { ...s, you: { ...s.you, hand: [...s.you.hand, drawn], library: rest } };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.activeSeatIndex]);

  function nextPhase() {
    setState(s => {
      const idx = PHASES.indexOf(s.phase);
      if (idx < PHASES.length - 1) {
        return { ...s, phase: PHASES[idx + 1] };
      }
      const nextSeat = (s.activeSeatIndex + 1) % 4;
      return { ...s, activeSeatIndex: nextSeat, phase: 'untap', turnNumber: nextSeat === 0 ? s.turnNumber + 1 : s.turnNumber };
    });
  }

  const activeSeatName = state.activeSeatIndex === 0 ? 'You' : state.opponents[state.activeSeatIndex - 1].name;

  // ── Your actions ──────────────────────────────────────────────────────────

  function playCard(name: string) {
    const id = uid();
    const isLand = (cardInfo(name)?.typeLine ?? '').toLowerCase().includes('land');
    setState(s => {
      const hand = [...s.you.hand];
      const i = hand.indexOf(name);
      if (i === -1) return s;
      hand.splice(i, 1);
      return {
        ...s,
        you: {
          ...s.you,
          hand,
          battlefield: [...s.you.battlefield, { id, name, tapped: false }],
          landPlayedThisTurn: isLand ? true : s.you.landPlayedThisTurn,
        },
      };
    });
    setJustPlayedId(id);
    setTimeout(() => setJustPlayedId(null), 500);
  }

  function castCommander() {
    if (!handoff.commander) return;
    const id = uid();
    setState(s => ({
      ...s,
      you: {
        ...s.you,
        commanderInZone: false,
        commanderCastCount: s.you.commanderCastCount + 1,
        battlefield: [...s.you.battlefield, { id, name: handoff.commander!, tapped: false }],
      },
    }));
    setJustPlayedId(id);
    setTimeout(() => setJustPlayedId(null), 500);
  }

  function toggleTap(id: string) {
    setState(s => ({ ...s, you: { ...s.you, battlefield: s.you.battlefield.map(c => c.id === id ? { ...c, tapped: !c.tapped } : c) } }));
  }

  function removePermanent(id: string, dest: 'graveyard' | 'exile' | 'hand') {
    setState(s => {
      const card = s.you.battlefield.find(c => c.id === id);
      if (!card) return s;
      const isCommander = card.name === handoff.commander;
      const battlefield = s.you.battlefield.filter(c => c.id !== id);
      if (isCommander && dest !== 'exile') {
        // Commanders return to the command zone instead of the graveyard/hand by default
        return { ...s, you: { ...s.you, battlefield, commanderInZone: true } };
      }
      if (dest === 'graveyard') return { ...s, you: { ...s.you, battlefield, graveyard: [...s.you.graveyard, card.name] } };
      if (dest === 'exile') return { ...s, you: { ...s.you, battlefield, exile: [...s.you.exile, card.name] } };
      return { ...s, you: { ...s.you, battlefield, hand: [...s.you.hand, card.name] } };
    });
  }

  function drawFromLibrary() {
    setState(s => {
      if (s.you.library.length === 0) return s;
      const [drawn, ...rest] = s.you.library;
      return { ...s, you: { ...s.you, hand: [...s.you.hand, drawn], library: rest } };
    });
  }

  function adjustLife(seat: 'you' | number, delta: number) {
    setState(s => {
      if (seat === 'you') return { ...s, you: { ...s.you, life: s.you.life + delta } };
      const opponents = [...s.opponents];
      opponents[seat] = { ...opponents[seat], life: opponents[seat].life + delta };
      return { ...s, opponents };
    });
  }

  function updateOpponent(i: number, patch: Partial<OpponentSeatState>) {
    setState(s => {
      const opponents = [...s.opponents];
      opponents[i] = { ...opponents[i], ...patch };
      return { ...s, opponents };
    });
  }

  function addOpponentChip(i: number, option: CardSearchOption) {
    setState(s => {
      const opponents = [...s.opponents];
      opponents[i] = {
        ...opponents[i],
        chips: [...opponents[i].chips, { id: uid(), name: option.name, imageUrl: option.imageUrl, typeLine: option.typeLine }],
      };
      return { ...s, opponents };
    });
  }

  function removeOpponentChip(i: number, chipId: string) {
    setState(s => {
      const opponents = [...s.opponents];
      opponents[i] = { ...opponents[i], chips: opponents[i].chips.filter(c => c.id !== chipId) };
      return { ...s, opponents };
    });
  }

  function cycleThreat(i: number) {
    const cur = THREAT_ORDER.indexOf(state.opponents[i].threat);
    updateOpponent(i, { threat: THREAT_ORDER[(cur + 1) % THREAT_ORDER.length] });
  }

  // ── Advisor (heuristic hints — not a rules engine) ─────────────────────────

  const advisorTip = useMemo(() => {
    if (state.activeSeatIndex !== 0) return `Waiting on ${activeSeatName}'s turn.`;
    if (state.phase === 'main1' || state.phase === 'main2') {
      if (!state.you.landPlayedThisTurn) {
        const land = state.you.hand.find(n => (cardInfo(n)?.typeLine ?? '').toLowerCase().includes('land'));
        if (land) return `Play ${land} — you haven't played a land this turn.`;
      }
      if (state.you.commanderInZone && commanderInfo) {
        const tax = 2 * state.you.commanderCastCount;
        const totalCost = (commanderInfo.cmc ?? 0) + tax;
        const untappedLands = state.you.battlefield.filter(c => !c.tapped && (cardInfo(c.name)?.typeLine ?? '').toLowerCase().includes('land')).length;
        if (untappedLands >= totalCost && totalCost > 0) {
          return `You may be able to cast ${handoff.commander} for ${totalCost} mana (${tax > 0 ? `includes +${tax} tax` : 'no tax yet'}).`;
        }
      }
    }
    if (state.phase === 'combat') {
      const untappedCreatures = state.you.battlefield.filter(c => !c.tapped && (cardInfo(c.name)?.typeLine ?? '').toLowerCase().includes('creature'));
      if (untappedCreatures.length > 0) return `You have ${untappedCreatures.length} untapped creature${untappedCreatures.length > 1 ? 's' : ''} that could attack.`;
    }
    return `Consider your options for ${PHASE_LABELS[state.phase]}.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ── Rendering ────────────────────────────────────────────────────────────

  function hover(name: string, imageUrl?: string | null) {
    setHoveredCard({ name, imageUrl: imageUrl ?? cardInfo(name)?.imageUrl ?? null });
  }

  const yourLanes = useMemo(
    () => groupByLane(state.you.battlefield, c => cardInfo(c.name)?.typeLine),
    [state.you.battlefield, cardInfo]
  );

  const seatSlots = [state.opponents[0], state.opponents[1], 'you' as const, state.opponents[2]];

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Phase header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-baseline gap-3">
          <span className="font-bold text-sm">Turn {state.turnNumber} — {state.activeSeatIndex === 0 ? 'your turn' : `${activeSeatName}'s turn`}</span>
          <span className="text-[10px] uppercase tracking-wide bg-amber-400 text-black px-2 py-0.5 rounded font-bold">{PHASE_LABELS[state.phase]}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={nextPhase} className="px-4 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition-colors">
            Next Phase →
          </button>
          <button type="button" onClick={() => setCompact(c => !c)} className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1.5">
            {compact ? 'Expand' : 'Compact'} view
          </button>
          <button type="button" onClick={onExit} className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Exit table
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 min-h-0">
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Quad grid — takes up the bulk of the screen */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
            {seatSlots.map((slot, i) => {
              if (slot === 'you') {
                return (
                  <div key="you" className="bg-zinc-900 border border-amber-700 rounded-xl p-4 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 mb-2 shrink-0">
                      <span className="text-base font-semibold flex-1">You</span>
                      <button type="button" onClick={() => adjustLife('you', -1)} className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">−</button>
                      <span className="text-2xl font-black text-amber-400 w-10 text-center">{state.you.life}</span>
                      <button type="button" onClick={() => adjustLife('you', 1)} className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">+</button>
                    </div>

                    {handoff.commander && (
                      <div className="flex items-center gap-2 mb-2 text-xs shrink-0">
                        <span className="text-zinc-500">Commander:</span>
                        {state.you.commanderInZone ? (
                          <button type="button" onClick={castCommander}
                            onMouseEnter={() => hover(handoff.commander!)} onMouseLeave={() => setHoveredCard(null)}
                            className="px-2 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800 hover:border-purple-600">
                            Cast {handoff.commander} {state.you.commanderCastCount > 0 ? `(+${state.you.commanderCastCount * 2} tax)` : ''}
                          </button>
                        ) : (
                          <span className="text-purple-400">{handoff.commander} (on battlefield)</span>
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                      {yourLanes.map(({ lane, items }) => (
                        <div key={lane}>
                          <p className="text-[9px] uppercase tracking-wide text-zinc-600 mb-1">{lane} ({items.length})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map(c => (
                              <div key={c.id}
                                className={`group relative w-12 rounded border transition-all ${c.tapped ? 'opacity-50 border-zinc-700' : 'border-zinc-700'} ${justPlayedId === c.id ? 'ring-2 ring-amber-400 scale-105' : ''}`}
                                onMouseEnter={() => hover(c.name)} onMouseLeave={() => setHoveredCard(null)}
                              >
                                <button type="button" onClick={() => toggleTap(c.id)} className="w-full text-left">
                                  <div className="bg-zinc-950 rounded-t flex items-center justify-center text-[7px] text-zinc-600">
                                    {cardInfo(c.name)?.imageUrl ? <img src={cardInfo(c.name)!.imageUrl!} alt={c.name} className="w-full h-auto rounded-t" /> : 'art'}
                                  </div>
                                </button>
                                <button type="button" onClick={() => removePermanent(c.id, 'graveyard')}
                                  title="Send to graveyard"
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {yourLanes.length === 0 && <p className="text-xs text-zinc-600">No permanents on the battlefield yet.</p>}
                    </div>

                    <div className="flex gap-3 mt-2 text-[10px] text-zinc-500 shrink-0">
                      <button type="button" onClick={drawFromLibrary} className="hover:text-zinc-300">Library: {state.you.library.length} (click to draw)</button>
                      <span>Graveyard: {state.you.graveyard.length}</span>
                      <span>Exile: {state.you.exile.length}</span>
                    </div>
                  </div>
                );
              }

              const oppIndex = state.opponents.indexOf(slot as OpponentSeatState);
              const opp = slot as OpponentSeatState;
              const isActive = state.activeSeatIndex === oppIndex + 1;
              const oppLanes = groupByLane(opp.chips, c => c.typeLine);
              return (
                <div key={oppIndex} className={`bg-zinc-900 border rounded-xl p-4 flex flex-col min-h-0 ${isActive ? 'border-amber-500' : 'border-zinc-800'}`}>
                  <div className="flex items-center gap-2 mb-2 shrink-0">
                    <input
                      type="text" value={opp.name} onChange={e => updateOpponent(oppIndex, { name: e.target.value })}
                      className="flex-1 bg-transparent text-base font-semibold focus:outline-none focus:bg-zinc-800 rounded px-1"
                    />
                    <button type="button" onClick={() => adjustLife(oppIndex, -1)} className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">−</button>
                    <span className="text-2xl font-black text-amber-400 w-10 text-center">{opp.life}</span>
                    <button type="button" onClick={() => adjustLife(oppIndex, 1)} className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">+</button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                    {oppLanes.map(({ lane, items }) => (
                      <div key={lane}>
                        <p className="text-[9px] uppercase tracking-wide text-zinc-600 mb-1">{lane} ({items.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map(chip => (
                            <div key={chip.id}
                              className="group relative w-12 rounded border border-zinc-700"
                              onMouseEnter={() => hover(chip.name, chip.imageUrl)} onMouseLeave={() => setHoveredCard(null)}
                            >
                              <div className="bg-zinc-950 rounded flex items-center justify-center text-[7px] text-zinc-600">
                                {chip.imageUrl ? <img src={chip.imageUrl} alt={chip.name} className="w-full h-auto rounded" /> : 'art'}
                              </div>
                              <button type="button" onClick={() => removeOpponentChip(oppIndex, chip.id)}
                                title="Remove"
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <OpponentCardPicker onAdd={opt => addOpponentChip(oppIndex, opt)} />
                  </div>

                  <div className="flex items-center gap-2 mt-2 shrink-0">
                    <button type="button" onClick={() => cycleThreat(oppIndex)}
                      className={`text-[10px] px-2 py-1 rounded font-medium ${THREAT_STYLES[opp.threat].className}`}>
                      {THREAT_STYLES[opp.threat].label}
                    </button>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 ml-auto">
                      <span>Hand:</span>
                      <button type="button" onClick={() => updateOpponent(oppIndex, { handCount: Math.max(0, opp.handCount - 1) })} className="w-4 h-4 rounded bg-zinc-800 hover:bg-zinc-700">−</button>
                      <span className="w-4 text-center">{opp.handCount}</span>
                      <button type="button" onClick={() => updateOpponent(oppIndex, { handCount: opp.handCount + 1 })} className="w-4 h-4 rounded bg-zinc-800 hover:bg-zinc-700">+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Advisor */}
          {!compact && (
            <div className="bg-green-950/30 border-l-4 border-green-600 rounded-lg px-3 py-2 shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-green-500 font-bold mb-1">Advisor</p>
              <p className="text-sm text-zinc-200">{advisorTip}</p>
            </div>
          )}

          {/* Hand */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Your Hand ({state.you.hand.length})</p>
              <button type="button" onClick={() => setHandCollapsed(c => !c)} className="text-xs text-zinc-500 hover:text-zinc-300">
                {handCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {state.you.hand.map((name, i) => {
                const info = cardInfo(name);
                const isLand = (info?.typeLine ?? '').toLowerCase().includes('land');
                return (
                  <button
                    key={`${name}-${i}`}
                    type="button"
                    onClick={() => playCard(name)}
                    onMouseEnter={() => hover(name)} onMouseLeave={() => setHoveredCard(null)}
                    className={`shrink-0 rounded-lg border-2 border-green-700 bg-zinc-950 overflow-hidden hover:border-green-500 transition-all ${handCollapsed ? 'w-16' : 'w-28'}`}
                  >
                    <div className="bg-zinc-900 flex items-center justify-center text-[9px] text-zinc-600">
                      <img src={info?.imageUrl ?? fallbackImg(name)} alt={name} className="w-full h-auto" />
                    </div>
                    {!handCollapsed && (
                      <div className="p-1.5">
                        <p className="text-[10px] font-medium truncate">{name}</p>
                        <p className="text-[9px] text-green-500">{isLand ? 'Play land' : 'Cast'}</p>
                      </div>
                    )}
                  </button>
                );
              })}
              {state.you.hand.length === 0 && <p className="text-xs text-zinc-600 py-4">No cards in hand.</p>}
            </div>
          </div>
        </div>

        {/* Phase rail */}
        {!compact && (
          <div className="w-36 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5 h-fit">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Turn Steps</p>
            {PHASES.map(p => (
              <div key={p} className={`text-xs px-2 py-1.5 rounded ${
                p === state.phase ? 'bg-amber-400 text-black font-semibold'
                  : PHASES.indexOf(p) < PHASES.indexOf(state.phase) && state.activeSeatIndex === 0 ? 'text-zinc-600'
                  : 'text-zinc-500'
              }`}>
                {PHASE_LABELS[p]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hover preview */}
      {hoveredCard && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <img
            src={hoveredCard.imageUrl ?? fallbackImg(hoveredCard.name)}
            alt={hoveredCard.name}
            className="w-56 rounded-xl border border-zinc-700 shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

function OpponentCardPicker({ onAdd }: { onAdd: (option: CardSearchOption) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CardSearchOption[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/simulator/card-search?q=${encodeURIComponent(query)}`)
        .then(r => r.ok ? r.json() : { results: [] })
        .then((d: { results: CardSearchOption[] }) => { if (!cancelled) setResults(d.results ?? []); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="text-[10px] px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 border-dashed text-zinc-500 hover:text-zinc-300 hover:border-zinc-600">
        + Add card
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setResults([]); setOpen(false); } }}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery(''); setResults([]); }, 150)}
        placeholder="Search card name…"
        className="text-[10px] px-1.5 py-1 rounded bg-zinc-800 border border-amber-600 text-zinc-200 w-32 focus:outline-none"
      />
      {searching && <p className="text-[9px] text-zinc-600 mt-0.5">Searching…</p>}
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {results.map(opt => (
            <button
              key={opt.scryfallId}
              type="button"
              onMouseDown={() => { onAdd(opt); setOpen(false); setQuery(''); setResults([]); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 transition-colors text-left"
            >
              {opt.imageUrl && <img src={opt.imageUrl} alt={opt.name} className="w-6 rounded shrink-0" />}
              <p className="text-[10px] text-zinc-200 truncate">{opt.name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
