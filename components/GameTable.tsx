'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { TableHandoff, TableCardInfo } from '@/lib/game-table-types';
import { TABLE_STATE_KEY } from '@/lib/game-table-types';
import { groupByLane } from '@/lib/battlefield-lanes';
import { AI_DECKS } from '@/lib/ai-opponent-decks';
import { parseDeckFromText } from '@/lib/parse-deck';
import { expandDeckToCards, shuffle } from '@/lib/deck-shuffle';
import { isLand, isCreature, isManaSource, planMainPhaseActions, declareAttackers, chooseBlocks } from '@/lib/ai-opponent';

type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';
const PHASES: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];
const PHASE_LABELS: Record<Phase, string> = {
  untap: 'Untap', upkeep: 'Upkeep', draw: 'Draw', main1: 'Main Phase 1',
  combat: 'Combat', main2: 'Main Phase 2', end: 'End Step',
};

interface BattlefieldCard { id: string; name: string; tapped: boolean; enteredTurn?: number; }

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

interface AISeatState {
  name: string;
  life: number;
  hand: string[];
  battlefield: BattlefieldCard[];
  graveyard: string[];
  library: string[];
  landPlayedThisTurn: boolean;
}

interface PendingBlocks {
  oppIndex: number;
  attackers: { id: string; name: string; power: number; toughness: number }[];
}

interface TableState {
  turnNumber: number;
  activeSeatIndex: number; // 0 = you, 1-3 = opponents[0..2]
  phase: Phase;
  you: YourSeatState;
  opponents: AISeatState[];
  log: string[];
  pendingBlocks: PendingBlocks | null;
  blockAssignments: Record<string, string | null>; // attacker id -> your blocker battlefield id
}

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}
function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
function pushLog(log: string[], line: string): string[] {
  const next = [...log, line];
  return next.length > 40 ? next.slice(next.length - 40) : next;
}

function makeAISeat(deckIndex: number): AISeatState {
  const deck = AI_DECKS[deckIndex];
  const parsed = parseDeckFromText(deck.list);
  const pool = shuffle(expandDeckToCards(parsed?.cards ?? {}));
  return {
    name: deck.name,
    life: 40,
    hand: pool.slice(0, 7),
    battlefield: [],
    graveyard: [],
    library: pool.slice(7),
    landPlayedThisTurn: false,
  };
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
    opponents: [makeAISeat(0), makeAISeat(1), makeAISeat(2)],
    log: ['Game started.'],
    pendingBlocks: null,
    blockAssignments: {},
  };
}

// Migrates game state saved before the AI-opponent rewrite (freeform chips,
// manual life/threat tracking) — those old saves can't be resumed, so just
// treat them as absent and start fresh.
function migrateState(raw: any, handoff: TableHandoff): TableState {
  if (!raw?.opponents?.[0] || typeof raw.opponents[0].chips !== 'undefined' || typeof raw.opponents[0].hand === 'undefined') {
    return makeInitialState(handoff);
  }
  return { pendingBlocks: null, blockAssignments: {}, log: [], ...raw } as TableState;
}

export default function GameTable({ handoff, onExit }: { handoff: TableHandoff; onExit: () => void }) {
  const [state, setState] = useState<TableState>(() => {
    try {
      const saved = localStorage.getItem(TABLE_STATE_KEY);
      if (saved) return migrateState(JSON.parse(saved), handoff);
    } catch { /* ignore */ }
    return makeInitialState(handoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
  const gameRef = useRef<TableState>(state);
  const aiRunningRef = useRef(false);

  function updateState(updater: (s: TableState) => TableState) {
    gameRef.current = updater(gameRef.current);
    setState(gameRef.current);
  }

  useEffect(() => {
    try { localStorage.setItem(TABLE_STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  // ── Card data: your cards arrive via handoff; opponents' decks need their own lookup ──

  const [extraCardData, setExtraCardData] = useState<Record<string, TableCardInfo>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const names = new Set<string>();
    for (const seat of gameRef.current.opponents) {
      for (const n of [...seat.hand, ...seat.library]) names.add(n);
    }
    const needed = [...names].filter(n => !handoff.cardData[n.toLowerCase()]);
    if (needed.length === 0) { setReady(true); return; }
    fetch('/api/simulator/resolve-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: needed }),
    })
      .then(r => r.ok ? r.json() : { cards: {} })
      .then((d: { cards: Record<string, TableCardInfo> }) => setExtraCardData(d.cards ?? {}))
      .catch(() => {})
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCardData = useMemo(() => ({ ...handoff.cardData, ...extraCardData }), [extraCardData]);
  const cardInfo = useCallback((name: string): TableCardInfo | undefined => allCardData[name.toLowerCase()], [allCardData]);

  const [compact, setCompact] = useState(false);
  const [handCollapsed, setHandCollapsed] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<{ name: string; imageUrl: string | null } | null>(null);
  const [justPlayedId, setJustPlayedId] = useState<string | null>(null);

  function fallbackImg(name: string) {
    return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  }
  function hover(name: string) {
    setHoveredCard({ name, imageUrl: allCardData[name.toLowerCase()]?.imageUrl ?? null });
  }

  const commanderInfo = handoff.commander ? cardInfo(handoff.commander) : undefined;

  // ── Your turn: untap/draw on entry ──────────────────────────────────────

  useEffect(() => {
    if (state.activeSeatIndex !== 0) return;
    if (state.phase === 'untap') {
      updateState(s => ({
        ...s,
        you: { ...s.you, battlefield: s.you.battlefield.map(c => ({ ...c, tapped: false })), landPlayedThisTurn: false },
      }));
    }
    if (state.phase === 'draw' && !(state.turnNumber === 1 && state.activeSeatIndex === 0)) {
      updateState(s => {
        if (s.you.library.length === 0) return s;
        const [drawn, ...rest] = s.you.library;
        return { ...s, you: { ...s.you, hand: [...s.you.hand, drawn], library: rest } };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.activeSeatIndex]);

  function nextPhase() {
    if (state.activeSeatIndex !== 0) return; // opponent turns run themselves
    updateState(s => {
      const idx = PHASES.indexOf(s.phase);
      if (idx < PHASES.length - 1) return { ...s, phase: PHASES[idx + 1] };
      const nextSeat = 1; // pass to the first opponent
      return { ...s, activeSeatIndex: nextSeat, phase: 'untap', turnNumber: s.turnNumber };
    });
  }

  const activeSeatName = state.activeSeatIndex === 0 ? 'You' : state.opponents[state.activeSeatIndex - 1].name;

  // ── AI opponent turn engine ──────────────────────────────────────────────

  const finishOpponentTurnTail = useCallback(async (oppIndex: number) => {
    await delay(300);
    updateState(s => ({ ...s, phase: 'main2' }));
    await delay(300);
    updateState(s => ({ ...s, phase: 'end' }));
    await delay(300);
    updateState(s => {
      const nextSeat = (s.activeSeatIndex + 1) % 4;
      return { ...s, activeSeatIndex: nextSeat, phase: 'untap', turnNumber: nextSeat === 0 ? s.turnNumber + 1 : s.turnNumber };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runOneOpponentTurn = useCallback(async (oppIndex: number): Promise<'paused' | 'continue'> => {
    updateState(s => {
      const opponents = [...s.opponents];
      const seat = opponents[oppIndex];
      opponents[oppIndex] = { ...seat, battlefield: seat.battlefield.map(c => ({ ...c, tapped: false })), landPlayedThisTurn: false };
      return { ...s, phase: 'untap', opponents };
    });
    await delay(450);

    updateState(s => ({ ...s, phase: 'upkeep' }));
    await delay(350);

    updateState(s => {
      const opponents = [...s.opponents];
      const seat = opponents[oppIndex];
      if (seat.library.length === 0) return { ...s, phase: 'draw' };
      const [drawn, ...rest] = seat.library;
      opponents[oppIndex] = { ...seat, hand: [...seat.hand, drawn], library: rest };
      return { ...s, phase: 'draw', opponents };
    });
    await delay(450);

    updateState(s => ({ ...s, phase: 'main1' }));
    await delay(300);

    const preSeat = gameRef.current.opponents[oppIndex];
    const untappedMana = preSeat.battlefield.filter(c => !c.tapped && isManaSource(cardInfo(c.name))).length;
    const youHaveCreature = gameRef.current.you.battlefield.some(c => isCreature(cardInfo(c.name)));
    const actions = planMainPhaseActions(preSeat.hand, untappedMana, preSeat.landPlayedThisTurn, cardInfo, youHaveCreature);

    for (const action of actions) {
      await delay(650);
      updateState(s => {
        const opponents = [...s.opponents];
        const cur = opponents[oppIndex];
        const idx = cur.hand.indexOf(action.name);
        if (idx === -1) return s;
        const hand = [...cur.hand];
        hand.splice(idx, 1);
        const newCard: BattlefieldCard = { id: uid(), name: action.name, tapped: false, enteredTurn: s.turnNumber };
        opponents[oppIndex] = {
          ...cur,
          hand,
          battlefield: [...cur.battlefield, newCard],
          landPlayedThisTurn: action.type === 'playLand' ? true : cur.landPlayedThisTurn,
        };
        const verb = action.type === 'playLand' ? 'plays' : 'casts';
        return { ...s, opponents, log: pushLog(s.log, `${cur.name} ${verb} ${action.name}.`) };
      });
    }

    await delay(400);
    updateState(s => ({ ...s, phase: 'combat' }));
    await delay(400);

    const combatSeat = gameRef.current.opponents[oppIndex];
    const attackerCandidates = combatSeat.battlefield
      .filter(c => !c.tapped && isCreature(cardInfo(c.name)) && c.enteredTurn !== gameRef.current.turnNumber)
      .map(c => ({ id: c.id, name: c.name, power: cardInfo(c.name)?.power ?? 0, toughness: cardInfo(c.name)?.toughness ?? 0 }));
    const yourBlockers = gameRef.current.you.battlefield
      .filter(c => !c.tapped && isCreature(cardInfo(c.name)))
      .map(c => ({ id: c.id, name: c.name, power: cardInfo(c.name)?.power ?? 0, toughness: cardInfo(c.name)?.toughness ?? 0 }));
    const attackers = declareAttackers(attackerCandidates, yourBlockers);

    if (attackers.length > 0) {
      updateState(s => ({
        ...s,
        pendingBlocks: { oppIndex, attackers },
        blockAssignments: Object.fromEntries(attackers.map(a => [a.id, null])),
        opponents: s.opponents.map((o, i) => i === oppIndex
          ? { ...o, battlefield: o.battlefield.map(c => attackers.some(a => a.id === c.id) ? { ...c, tapped: true } : c) }
          : o),
        log: pushLog(s.log, `${combatSeat.name} attacks with ${attackers.map(a => a.name).join(', ')}.`),
      }));
      return 'paused';
    }

    await finishOpponentTurnTail(oppIndex);
    return 'continue';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardInfo, finishOpponentTurnTail]);

  const runOpponentChain = useCallback(async (startIndex: number) => {
    if (aiRunningRef.current) return;
    aiRunningRef.current = true;
    let idx = startIndex;
    while (idx !== 0 && idx >= 1 && idx <= 3) {
      // idx is a seat index (1-3, matching activeSeatIndex); opponents[] is 0-indexed
      const result = await runOneOpponentTurn(idx - 1);
      if (result === 'paused') { aiRunningRef.current = false; return; }
      idx = gameRef.current.activeSeatIndex;
    }
    aiRunningRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runOneOpponentTurn]);

  useEffect(() => {
    if (!ready) return;
    if (state.activeSeatIndex !== 0 && !state.pendingBlocks) {
      runOpponentChain(state.activeSeatIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, state.activeSeatIndex, state.pendingBlocks]);

  // ── Blocking ─────────────────────────────────────────────────────────────

  function assignBlocker(attackerId: string, blockerId: string | null) {
    updateState(s => ({ ...s, blockAssignments: { ...s.blockAssignments, [attackerId]: blockerId } }));
  }

  function confirmBlocks() {
    const pending = gameRef.current.pendingBlocks;
    if (!pending) return;
    const { oppIndex, attackers } = pending;
    const assignments = gameRef.current.blockAssignments;

    updateState(s => {
      const you = { ...s.you };
      const opponents = [...s.opponents];
      const oppSeat = { ...opponents[oppIndex] };
      let yourBattlefield = [...you.battlefield];
      let oppBattlefield = [...oppSeat.battlefield];
      let log = s.log;
      let lifeLoss = 0;

      for (const atk of attackers) {
        const blockerId = assignments[atk.id];
        const blockerCard = blockerId ? yourBattlefield.find(c => c.id === blockerId) : undefined;

        if (!blockerCard) {
          lifeLoss += atk.power;
          log = pushLog(log, `${oppSeat.name}'s ${atk.name} hits you for ${atk.power}.`);
          continue;
        }

        const bInfo = cardInfo(blockerCard.name);
        const bPower = bInfo?.power ?? 0;
        const bToughness = bInfo?.toughness ?? 0;
        const attackerDies = bPower >= atk.toughness;
        const blockerDies = atk.power >= bToughness;

        if (attackerDies) {
          oppBattlefield = oppBattlefield.filter(c => c.id !== atk.id);
          oppSeat.graveyard = [...oppSeat.graveyard, atk.name];
        }
        if (blockerDies) {
          yourBattlefield = yourBattlefield.filter(c => c.id !== blockerCard.id);
          you.graveyard = [...you.graveyard, blockerCard.name];
        }
        const outcome = [attackerDies && `${atk.name} dies`, blockerDies && `${blockerCard.name} dies`].filter(Boolean).join(', ');
        log = pushLog(log, `${blockerCard.name} blocks ${atk.name}${outcome ? ` — ${outcome}` : ''}.`);
      }

      you.battlefield = yourBattlefield;
      you.life -= lifeLoss;
      oppSeat.battlefield = oppBattlefield;
      opponents[oppIndex] = oppSeat;

      return { ...s, you, opponents, log, pendingBlocks: null, blockAssignments: {} };
    });

    finishOpponentTurnTail(oppIndex).then(() => {
      const next = gameRef.current.activeSeatIndex;
      if (next !== 0) runOpponentChain(next);
    });
  }

  // ── Your attacks (mirrors the AI's attack-you flow, reversed) ──────────────

  // attacker battlefield id -> opponent array index (0-2) or null (not attacking).
  // Local, transient UI state — not persisted, since it's only meaningful mid-decision on your own turn.
  const [attackTargets, setAttackTargets] = useState<Record<string, number | null>>({});
  const [declaringAttack, setDeclaringAttack] = useState(false);

  const eligibleAttackers = useMemo(() => {
    if (state.activeSeatIndex !== 0 || state.phase !== 'combat') return [];
    return state.you.battlefield.filter(c => !c.tapped && isCreature(cardInfo(c.name)) && c.enteredTurn !== state.turnNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSeatIndex, state.phase, state.you.battlefield, state.turnNumber, allCardData]);

  // ── Auto-advance your own turn ──────────────────────────────────────────
  // Untap/Upkeep/Draw/End have nothing to decide, so they advance on their
  // own — same pacing as opponent turns. Main phases and Combat only pause
  // and wait for you when there's an actual choice available: a playable
  // card in hand, or a creature that could attack. Otherwise they skip
  // forward too, so you're never stuck clicking through empty steps.
  const hasPriorityPlay = useMemo(() => {
    if (state.activeSeatIndex !== 0) return false;
    if (state.phase === 'combat') return eligibleAttackers.length > 0;
    if (state.phase === 'main1' || state.phase === 'main2') {
      const untappedMana = state.you.battlefield.filter(c => !c.tapped && isManaSource(cardInfo(c.name))).length;
      return state.you.hand.some(name => {
        const info = cardInfo(name);
        if (isLand(info)) return !state.you.landPlayedThisTurn;
        return (info?.cmc ?? 0) <= untappedMana;
      });
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSeatIndex, state.phase, state.you.hand, state.you.battlefield, state.you.landPlayedThisTurn, eligibleAttackers.length, allCardData]);

  useEffect(() => {
    if (state.activeSeatIndex !== 0) return; // opponent turns run themselves
    if (state.pendingBlocks || declaringAttack) return; // don't race an in-flight decision
    if (hasPriorityPlay) return; // something to do — wait for you
    const t = setTimeout(() => nextPhase(), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSeatIndex, state.phase, state.pendingBlocks, declaringAttack, hasPriorityPlay]);

  async function declareYourAttacks() {
    const entries = Object.entries(attackTargets).filter((e): e is [string, number] => e[1] !== null && e[1] !== undefined);
    if (entries.length === 0) return;
    setDeclaringAttack(true);

    const names = entries.map(([id]) => gameRef.current.you.battlefield.find(c => c.id === id)?.name).filter(Boolean).join(', ');
    updateState(s => ({
      ...s,
      you: { ...s.you, battlefield: s.you.battlefield.map(c => attackTargets[c.id] != null ? { ...c, tapped: true } : c) },
      log: pushLog(s.log, `You attack with ${names}.`),
    }));
    await delay(500);

    const byOpponent = new Map<number, { id: string; name: string; power: number; toughness: number }[]>();
    for (const [attackerId, oppIdx] of entries) {
      const card = gameRef.current.you.battlefield.find(c => c.id === attackerId);
      if (!card) continue;
      const info = cardInfo(card.name);
      const list = byOpponent.get(oppIdx) ?? [];
      list.push({ id: card.id, name: card.name, power: info?.power ?? 0, toughness: info?.toughness ?? 0 });
      byOpponent.set(oppIdx, list);
    }

    for (const [oppIdx, atks] of byOpponent) {
      const opp = gameRef.current.opponents[oppIdx];
      const availableDefenders = opp.battlefield
        .filter(c => !c.tapped && isCreature(cardInfo(c.name)))
        .map(c => ({ id: c.id, name: c.name, power: cardInfo(c.name)?.power ?? 0, toughness: cardInfo(c.name)?.toughness ?? 0 }));
      const blocks = chooseBlocks(atks, availableDefenders, opp.life);

      updateState(s => {
        const opponents = [...s.opponents];
        const oppSeat = { ...opponents[oppIdx] };
        let oppBattlefield = [...oppSeat.battlefield];
        const you = { ...s.you };
        let yourBattlefield = [...you.battlefield];
        let log = s.log;
        let lifeLoss = 0;

        for (const atk of atks) {
          const blockerId = blocks[atk.id];
          const blockerCard = blockerId ? oppBattlefield.find(c => c.id === blockerId) : undefined;

          if (!blockerCard) {
            lifeLoss += atk.power;
            log = pushLog(log, `${atk.name} hits ${oppSeat.name} for ${atk.power}.`);
            continue;
          }

          const bInfo = cardInfo(blockerCard.name);
          const bPower = bInfo?.power ?? 0;
          const bToughness = bInfo?.toughness ?? 0;
          const attackerDies = bPower >= atk.toughness;
          const blockerDies = atk.power >= bToughness;

          if (attackerDies) {
            yourBattlefield = yourBattlefield.filter(c => c.id !== atk.id);
            you.graveyard = [...you.graveyard, atk.name];
          }
          if (blockerDies) {
            oppBattlefield = oppBattlefield.filter(c => c.id !== blockerCard.id);
            oppSeat.graveyard = [...oppSeat.graveyard, blockerCard.name];
          }
          const outcome = [attackerDies && `${atk.name} dies`, blockerDies && `${blockerCard.name} dies`].filter(Boolean).join(', ');
          log = pushLog(log, `${oppSeat.name} blocks ${atk.name} with ${blockerCard.name}${outcome ? ` — ${outcome}` : ''}.`);
        }

        oppSeat.life -= lifeLoss;
        oppSeat.battlefield = oppBattlefield;
        opponents[oppIdx] = oppSeat;
        you.battlefield = yourBattlefield;
        return { ...s, you, opponents, log };
      });
      await delay(500);
    }

    setAttackTargets({});
    setDeclaringAttack(false);
  }

  // ── Your actions ──────────────────────────────────────────────────────────

  function playCard(name: string) {
    const id = uid();
    const land = isLand(cardInfo(name));
    updateState(s => {
      const hand = [...s.you.hand];
      const i = hand.indexOf(name);
      if (i === -1) return s;
      hand.splice(i, 1);
      return {
        ...s,
        you: {
          ...s.you,
          hand,
          battlefield: [...s.you.battlefield, { id, name, tapped: false, enteredTurn: s.turnNumber }],
          landPlayedThisTurn: land ? true : s.you.landPlayedThisTurn,
        },
      };
    });
    setJustPlayedId(id);
    setTimeout(() => setJustPlayedId(null), 500);
  }

  function castCommander() {
    if (!handoff.commander) return;
    const id = uid();
    updateState(s => ({
      ...s,
      you: {
        ...s.you,
        commanderInZone: false,
        commanderCastCount: s.you.commanderCastCount + 1,
        battlefield: [...s.you.battlefield, { id, name: handoff.commander!, tapped: false, enteredTurn: s.turnNumber }],
      },
    }));
    setJustPlayedId(id);
    setTimeout(() => setJustPlayedId(null), 500);
  }

  function toggleTap(id: string) {
    updateState(s => ({ ...s, you: { ...s.you, battlefield: s.you.battlefield.map(c => c.id === id ? { ...c, tapped: !c.tapped } : c) } }));
  }

  function removePermanent(id: string, dest: 'graveyard' | 'exile' | 'hand') {
    updateState(s => {
      const card = s.you.battlefield.find(c => c.id === id);
      if (!card) return s;
      const isCommander = card.name === handoff.commander;
      const battlefield = s.you.battlefield.filter(c => c.id !== id);
      if (isCommander && dest !== 'exile') {
        return { ...s, you: { ...s.you, battlefield, commanderInZone: true } };
      }
      if (dest === 'graveyard') return { ...s, you: { ...s.you, battlefield, graveyard: [...s.you.graveyard, card.name] } };
      if (dest === 'exile') return { ...s, you: { ...s.you, battlefield, exile: [...s.you.exile, card.name] } };
      return { ...s, you: { ...s.you, battlefield, hand: [...s.you.hand, card.name] } };
    });
  }

  function drawFromLibrary() {
    updateState(s => {
      if (s.you.library.length === 0) return s;
      const [drawn, ...rest] = s.you.library;
      return { ...s, you: { ...s.you, hand: [...s.you.hand, drawn], library: rest } };
    });
  }

  function adjustLife(delta: number) {
    updateState(s => ({ ...s, you: { ...s.you, life: s.you.life + delta } }));
  }

  // ── Advisor (heuristic hints — not a rules engine) ─────────────────────────

  const advisorTip = useMemo(() => {
    if (state.pendingBlocks) return 'Assign blockers below, then confirm.';
    if (state.activeSeatIndex !== 0) return `${activeSeatName} is taking their turn…`;
    if (state.phase === 'main1' || state.phase === 'main2') {
      if (!state.you.landPlayedThisTurn) {
        const land = state.you.hand.find(n => isLand(cardInfo(n)));
        if (land) return `Play ${land} — you haven't played a land this turn.`;
      }
      if (state.you.commanderInZone && commanderInfo) {
        const tax = 2 * state.you.commanderCastCount;
        const totalCost = (commanderInfo.cmc ?? 0) + tax;
        const untappedLands = state.you.battlefield.filter(c => !c.tapped && isLand(cardInfo(c.name))).length;
        if (untappedLands >= totalCost && totalCost > 0) {
          return `You may be able to cast ${handoff.commander} for ${totalCost} mana (${tax > 0 ? `includes +${tax} tax` : 'no tax yet'}).`;
        }
      }
    }
    if (state.phase === 'combat') {
      const untappedCreatures = state.you.battlefield.filter(c => !c.tapped && isCreature(cardInfo(c.name)));
      if (untappedCreatures.length > 0) return `You have ${untappedCreatures.length} untapped creature${untappedCreatures.length > 1 ? 's' : ''} that could attack.`;
    }
    return `Consider your options for ${PHASE_LABELS[state.phase]}.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ── Rendering ────────────────────────────────────────────────────────────

  const yourLanes = useMemo(
    () => groupByLane(state.you.battlefield, c => cardInfo(c.name)?.typeLine),
    [state.you.battlefield, cardInfo]
  );

  function renderOpponentSeat(oppIndex: number) {
    const opp = state.opponents[oppIndex];
    const isActive = state.activeSeatIndex === oppIndex + 1;
    const oppLanes = groupByLane(opp.battlefield, c => cardInfo(c.name)?.typeLine);
    return (
      <div key={oppIndex} className={`bg-zinc-900 border rounded-xl p-4 flex flex-col min-h-0 ${isActive ? 'border-amber-500' : 'border-zinc-800'}`}>
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <span className="text-base font-semibold flex-1">{opp.name}</span>
          <span className="text-[10px] text-zinc-600">{opp.hand.length} in hand</span>
          <span className="text-2xl font-black text-amber-400 w-10 text-center">{opp.life}</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {oppLanes.map(({ lane, items }) => (
            <div key={lane}>
              <p className="text-[9px] uppercase tracking-wide text-zinc-600 mb-1">{lane} ({items.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map(c => (
                  <div key={c.id}
                    className={`relative w-12 rounded border ${c.tapped ? 'opacity-50 border-zinc-700' : 'border-zinc-700'}`}
                    onMouseEnter={() => hover(c.name)} onMouseLeave={() => setHoveredCard(null)}
                  >
                    <div className="bg-zinc-950 rounded flex items-center justify-center text-[7px] text-zinc-600">
                      {cardInfo(c.name)?.imageUrl ? <img src={cardInfo(c.name)!.imageUrl!} alt={c.name} className="w-full h-auto rounded" /> : 'art'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {oppLanes.length === 0 && <p className="text-xs text-zinc-600">No permanents yet.</p>}
        </div>

        <p className="text-[10px] text-zinc-600 mt-2 shrink-0">Library: {opp.library.length} · Graveyard: {opp.graveyard.length}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Setting up your opponents…</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Phase header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-baseline gap-3">
          <span className="font-bold text-sm">Turn {state.turnNumber} — {state.activeSeatIndex === 0 ? 'your turn' : `${activeSeatName}'s turn`}</span>
          <span className="text-[10px] uppercase tracking-wide bg-amber-400 text-black px-2 py-0.5 rounded font-bold">{PHASE_LABELS[state.phase]}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={nextPhase} disabled={state.activeSeatIndex !== 0}
            className="px-4 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
          {/* Quad grid */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
            {renderOpponentSeat(0)}
            {renderOpponentSeat(1)}

            <div className="bg-zinc-900 border border-amber-700 rounded-xl p-4 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <span className="text-base font-semibold flex-1">You</span>
                <button type="button" onClick={() => adjustLife(-1)} className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">−</button>
                <span className="text-2xl font-black text-amber-400 w-10 text-center">{state.you.life}</span>
                <button type="button" onClick={() => adjustLife(1)} className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-sm">+</button>
              </div>

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

            {renderOpponentSeat(2)}
          </div>

          {/* Blocking panel */}
          {state.pendingBlocks && (
            <div className="bg-red-950/30 border-l-4 border-red-600 rounded-lg px-3 py-3 shrink-0 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-red-400 font-bold">
                {state.opponents[state.pendingBlocks.oppIndex].name} is attacking
              </p>
              <div className="space-y-1.5">
                {state.pendingBlocks.attackers.map(atk => {
                  const yourUntapped = state.you.battlefield.filter(c => !c.tapped && isCreature(cardInfo(c.name)));
                  return (
                    <div key={atk.id} className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-200 w-48 truncate">{atk.name} ({atk.power}/{atk.toughness})</span>
                      <select
                        value={state.blockAssignments[atk.id] ?? ''}
                        onChange={e => assignBlocker(atk.id, e.target.value || null)}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">No block — take {atk.power}</option>
                        {yourUntapped
                          .filter(c => !Object.entries(state.blockAssignments).some(([aid, bid]) => bid === c.id && aid !== atk.id))
                          .map(c => {
                            const info = cardInfo(c.name);
                            return <option key={c.id} value={c.id}>{c.name} ({info?.power ?? 0}/{info?.toughness ?? 0})</option>;
                          })}
                      </select>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={confirmBlocks}
                className="px-4 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition-colors">
                Confirm Blocks
              </button>
            </div>
          )}

          {/* Your attackers panel */}
          {eligibleAttackers.length > 0 && !state.pendingBlocks && (
            <div className="bg-amber-950/20 border-l-4 border-amber-600 rounded-lg px-3 py-3 shrink-0 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-amber-400 font-bold">Attack</p>
              <div className="space-y-1.5">
                {eligibleAttackers.map(c => {
                  const info = cardInfo(c.name);
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-200 w-48 truncate">{c.name} ({info?.power ?? 0}/{info?.toughness ?? 0})</span>
                      <select
                        value={attackTargets[c.id] ?? ''}
                        onChange={e => setAttackTargets(prev => ({ ...prev, [c.id]: e.target.value === '' ? null : Number(e.target.value) }))}
                        disabled={declaringAttack}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Not attacking</option>
                        {state.opponents.map((opp, i) => <option key={i} value={i}>{opp.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={declareYourAttacks} disabled={declaringAttack || !Object.values(attackTargets).some(v => v !== null && v !== undefined)}
                className="px-4 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {declaringAttack ? 'Resolving…' : 'Declare Attacks'}
              </button>
            </div>
          )}

          {/* Advisor */}
          {!compact && (
            <div className="bg-green-950/30 border-l-4 border-green-600 rounded-lg px-3 py-2 shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-green-500 font-bold mb-1">Advisor</p>
              <p className="text-sm text-zinc-200">{advisorTip}</p>
            </div>
          )}

          {/* Command zone + Hand */}
          <div className="flex gap-3 shrink-0 items-start">
            {handoff.commander && (
              <div className="w-28 shrink-0 rounded-lg border-2 border-purple-700 bg-zinc-950 overflow-hidden flex flex-col">
                <p className="text-[9px] uppercase tracking-wide text-purple-400 text-center py-1 bg-purple-950/50 shrink-0">Command Zone</p>
                <div
                  onMouseEnter={() => hover(handoff.commander!)} onMouseLeave={() => setHoveredCard(null)}
                  className="bg-zinc-900 flex items-center justify-center text-[9px] text-zinc-600"
                >
                  {commanderInfo?.imageUrl
                    ? <img src={commanderInfo.imageUrl} alt={handoff.commander} className="w-full h-auto" />
                    : <div className="aspect-[5/7] w-full" />}
                </div>
                <div className="p-1.5 shrink-0">
                  {state.you.commanderInZone ? (
                    <button type="button" onClick={castCommander}
                      className="w-full text-[10px] font-semibold text-purple-300 hover:text-purple-100 text-center transition-colors">
                      Cast{state.you.commanderCastCount > 0 ? ` (+${state.you.commanderCastCount * 2})` : ''}
                    </button>
                  ) : (
                    <p className="text-[9px] text-zinc-500 text-center">On battlefield</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Your Hand ({state.you.hand.length})</p>
                <button type="button" onClick={() => setHandCollapsed(c => !c)} className="text-xs text-zinc-500 hover:text-zinc-300">
                  {handCollapsed ? 'Expand' : 'Collapse'}
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {state.you.hand.map((name, i) => {
                  const info = cardInfo(name);
                  const land = isLand(info);
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
                          <p className="text-[9px] text-green-500">{land ? 'Play land' : 'Cast'}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
                {state.you.hand.length === 0 && <p className="text-xs text-zinc-600 py-4">No cards in hand.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="w-56 shrink-0 flex flex-col gap-3">
          {/* Phase rail */}
          {!compact && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Turn Steps</p>
              {PHASES.map(p => (
                <div key={p} className={`text-xs px-2 py-1.5 rounded ${
                  p === state.phase ? 'bg-amber-400 text-black font-semibold'
                    : PHASES.indexOf(p) < PHASES.indexOf(state.phase) ? 'text-zinc-600'
                    : 'text-zinc-500'
                }`}>
                  {PHASE_LABELS[p]}
                </div>
              ))}
            </div>
          )}

          {/* Game log */}
          <div className="flex-1 min-h-0 bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2 shrink-0">Game Log</p>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
              {[...state.log].reverse().map((line, i) => (
                <p key={i} className="text-[11px] text-zinc-400 leading-snug">{line}</p>
              ))}
            </div>
          </div>
        </div>
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
