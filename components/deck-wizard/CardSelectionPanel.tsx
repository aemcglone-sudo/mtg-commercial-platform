'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ManaChart } from './ManaChart';
import CardDetailModal from '@/components/CardDetailModal';

interface CardSuggestion {
  name: string;
  reason: string;
  likelyOwned: boolean;
  priceTier: string;
  budgetAlternative: string | null;
  suggestedQuantity?: number;
}

interface RoleGroup {
  role: string;
  target: number;
  cards: CardSuggestion[];
}

interface CardMeta {
  cmc: number;
  typeLine: string;
  manaCost: string;
  power?: string;
  toughness?: string;
  colors: string[];
}

interface Props {
  sessionId: string | null;
  format: string;
  commander: string | null;
  commanderColorIdentity: string[];
  archetype: string | null;
  themes: string[];
  tribalType: string | null;
  psychographic: string | null;
  budgetCents: number | null;
  roleTargets: Record<string, number> | null;
  deckColors: string[];
  ownedCardNames: string[];
  collectionOnly: boolean;
  initialCards: Record<string, number>;
  onConfirm: (cards: Record<string, number>) => void;
  onBack: () => void;
}

const PRICE_TIER_COLORS: Record<string, string> = {
  budget: 'text-green-400',
  mid: 'text-amber-400',
  expensive: 'text-orange-400',
  premium: 'text-red-400',
};

const COLOR_PIPS: Record<string, string> = {
  W: 'bg-yellow-100 text-yellow-900',
  U: 'bg-blue-600 text-white',
  B: 'bg-zinc-800 text-zinc-200 border border-zinc-600',
  R: 'bg-red-600 text-white',
  G: 'bg-green-700 text-white',
  C: 'bg-zinc-600 text-white',
};

const DECK_SIZES: Record<string, number> = {
  commander: 100, brawl: 100, oathbreaker: 60, tiny_leaders: 50,
  standard: 60, pioneer: 60, modern: 60, legacy: 60, vintage: 60,
  pauper: 60, historic: 60, timeless: 60, penny_dreadful: 60,
  canadian_highlander: 100,
};

const BASIC_LANDS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes',
  'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);

function shortType(typeLine: string): string {
  // Return the most specific part after '—' or just the first word
  const sub = typeLine.split('—')[1]?.trim();
  if (sub) return sub.split(' ')[0];
  const main = typeLine.split('—')[0].trim();
  // Shorten compound types
  if (main.includes('Legendary Creature')) return 'Legendary';
  if (main.includes('Instant')) return 'Instant';
  if (main.includes('Sorcery')) return 'Sorcery';
  if (main.includes('Enchantment')) return 'Enchantment';
  if (main.includes('Artifact')) return 'Artifact';
  if (main.includes('Planeswalker')) return 'Planeswalker';
  if (main.includes('Creature')) return 'Creature';
  if (main.includes('Land')) return 'Land';
  return main.split(' ')[0];
}

export function CardSelectionPanel({
  sessionId, format, commander, commanderColorIdentity, archetype, themes, tribalType,
  psychographic, budgetCents, roleTargets, deckColors, ownedCardNames, collectionOnly, initialCards, onConfirm, onBack
}: Props) {
  const [roles, setRoles] = useState<RoleGroup[]>([]);
  const [loading, setLoading] = useState(true); // start true — fetch fires immediately
  const [loadError, setLoadError] = useState(false);
  const [loadStage, setLoadStage] = useState(0); // 0-4 for progress steps
  const [deck, setDeck] = useState<Record<string, number>>(initialCards);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [cardMeta, setCardMeta] = useState<Record<string, CardMeta>>({});
  const [cmcLoading, setCmcLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  // Track which names we've already requested to avoid stale-closure re-fetches
  const fetchedNamesRef = useRef<Set<string>>(new Set());

  const LOAD_STAGES = [
    'Analyzing your commander and themes…',
    'Researching staples and synergies…',
    'Organizing suggestions by role…',
    'Finalizing card picks…',
    'Almost there…',
  ];

  const deckSize = DECK_SIZES[format] ?? 60;
  const totalCards = Object.values(deck).reduce((s, q) => s + q, 0);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setLoadStage(0);

    // Advance progress stages on a timer while waiting for the AI
    const stageTimer = setInterval(() => {
      setLoadStage(prev => Math.min(prev + 1, LOAD_STAGES.length - 1));
    }, 3500);

    try {
      const res = await fetch('/api/deck-wizard/suggest-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, format, commander, commanderColorIdentity, archetype, themes,
          tribalType, psychographic, budgetCents, currentCards: initialCards,
          ownedCardNames, roleTargets, deckColors, collectionOnly,
        }),
      });
      const data = await res.json() as { roles: RoleGroup[]; summary?: string };
      if (!res.ok) {
        console.error('[suggest-cards] API error', res.status, data);
      }
      const fetchedRoles = data.roles ?? [];
      setRoles(fetchedRoles);
      setExpandedRole('Creature');
      if (!fetchedRoles.length) { setLoadError(true); return; }

      // Auto-populate the deck with all non-land suggestions so the curve
      // is immediately meaningful. Users can remove cards they don't want.
      const nonLandRoles = fetchedRoles.filter(g => g.role.toLowerCase() !== 'lands');
      const landsRole = fetchedRoles.find(g => g.role.toLowerCase() === 'lands');
      // Reserve slots for lands — non-land cards must not crowd them out.
      // For non-commander formats, cards use 4x/3x/2x quantities so totals can easily hit 60 before basics are added.
      const minLands = landsRole?.target ?? (deckSize === 100 ? 35 : 22);
      const nonLandBudget = deckSize - minLands;

      // Read current deck directly from initialCards (closure is stale-safe here
      // since this only runs once on mount)
      const autoAdded: Record<string, number> = {};
      let autoAddedCount = Object.values(initialCards).reduce((s, q) => s + q, 0);
      for (const group of nonLandRoles) {
        for (const card of group.cards) {
          if (!(card.name in initialCards) && !(card.name in autoAdded)) {
            const qty = card.suggestedQuantity ?? 1;
            if (autoAddedCount + qty > nonLandBudget) continue; // don't crowd out lands
            autoAdded[card.name] = qty;
            autoAddedCount += qty;
          }
        }
      }
      const newDeck = { ...initialCards, ...autoAdded };
      setDeck(newDeck);

      // Always fill basics up to at least minLands
      fetch('/api/deck-wizard/fill-basics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: Object.entries(newDeck).map(([name, quantity]) => ({ name, quantity })),
          deckSize,
          colorIdentity: commanderColorIdentity.length ? commanderColorIdentity : deckColors,
          minLands,
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then((d: { basics: Record<string, number> } | null) => {
          if (d?.basics) setDeck(p => ({ ...p, ...d.basics }));
        })
        .catch(() => {});
    } catch {
      setLoadError(true);
    } finally {
      clearInterval(stageTimer);
      setLoading(false);
    }
  }, [sessionId, format, commander, commanderColorIdentity, archetype, themes, tribalType, psychographic, budgetCents, ownedCardNames, roleTargets, deckSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchSuggestions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch card metadata from Scryfall whenever deck or suggestions change.
  // Uses a ref to track fetched names so the closure doesn't go stale.
  useEffect(() => {
    const deckNames = Object.keys(deck).filter(n => !BASIC_LANDS.has(n));
    const suggestionNames = roles.flatMap(g => g.cards.map(c => c.name));
    const allNames = [...new Set([...deckNames, ...suggestionNames])];
    const unknown = allNames.filter(n => !fetchedNamesRef.current.has(n));
    if (unknown.length === 0) return;

    // Mark as fetched immediately so concurrent renders don't re-request
    unknown.forEach(n => fetchedNamesRef.current.add(n));

    setCmcLoading(true);
    const chunks: string[][] = [];
    for (let i = 0; i < unknown.length; i += 75) chunks.push(unknown.slice(i, i + 75));

    Promise.all(
      chunks.map(chunk =>
        fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
        })
          .then(r => r.ok ? r.json() : { data: [] })
          .then((d: { data: Array<{ name: string; cmc: number; type_line: string; mana_cost?: string; power?: string; toughness?: string; colors: string[] }> }) => d.data ?? [])
      )
    ).then(results => {
      const updates: Record<string, CardMeta> = {};
      for (const batch of results) {
        for (const card of batch) {
          updates[card.name] = {
            cmc: card.cmc ?? 0,
            typeLine: card.type_line ?? '',
            manaCost: card.mana_cost ?? '',
            power: card.power,
            toughness: card.toughness,
            colors: card.colors ?? [],
          };
        }
      }
      if (Object.keys(updates).length > 0) setCardMeta(prev => ({ ...prev, ...updates }));
    }).catch(() => {
      // On error, remove from fetched set so they can be retried
      unknown.forEach(n => fetchedNamesRef.current.delete(n));
    }).finally(() => setCmcLoading(false));
  }, [deck, roles]); // eslint-disable-line react-hooks/exhaustive-deps

  function addCard(name: string, quantity = 1) {
    setDeck(prev => ({ ...prev, [name]: (prev[name] ?? 0) + quantity }));
  }

  function removeCard(name: string) {
    setDeck(prev => {
      const q = (prev[name] ?? 0) - 1;
      if (q <= 0) { const next = { ...prev }; delete next[name]; return next; }
      return { ...prev, [name]: q };
    });
  }

  async function addAllAndFillLands() {
    const nonLandRoles = roles.filter(g => g.role.toLowerCase() !== 'lands');
    const toAdd: Record<string, number> = {};
    for (const group of nonLandRoles) {
      for (const card of group.cards) {
        if (!(card.name in deck)) toAdd[card.name] = card.suggestedQuantity ?? 1;
      }
    }
    const nextDeck = { ...deck, ...toAdd };
    setDeck(nextDeck);

    const currentCount = Object.values(nextDeck).reduce((s, q) => s + q, 0);
    if (currentCount < deckSize) {
      try {
        const res = await fetch('/api/deck-wizard/fill-basics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cards: Object.entries(nextDeck).map(([name, quantity]) => ({ name, quantity })),
            deckSize,
            colorIdentity: commanderColorIdentity.length ? commanderColorIdentity : deckColors,
          }),
        });
        const data = await res.json() as { basics: Record<string, number> };
        if (data.basics) setDeck(prev => ({ ...prev, ...data.basics }));
      } catch { /* best effort */ }
    }
  }

  const deckCards = Object.entries(deck).map(([name, quantity]) => ({ name, quantity }));
  const nonLandDeckCards = deckCards.filter(c => !BASIC_LANDS.has(c.name));
  const progress = Math.min(100, (totalCards / deckSize) * 100);

  // Flatten all suggestions and group by card type using Scryfall metadata
  const TYPE_ORDER = ['Creature', 'Planeswalker', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Other'];
  function primaryType(typeLine: string): string {
    if (!typeLine) return 'Other';
    const t = typeLine.split('—')[0];
    for (const ty of ['Creature', 'Planeswalker', 'Artifact', 'Enchantment', 'Instant', 'Sorcery']) {
      if (t.includes(ty)) return ty;
    }
    return 'Other';
  }

  // Flatten all non-land suggestions, deduplicate by card name
  const allSuggestions = new Map<string, CardSuggestion & { role: string }>();
  for (const group of roles) {
    if (group.role.toLowerCase() === 'lands') continue;
    for (const card of group.cards) {
      if (!allSuggestions.has(card.name)) {
        allSuggestions.set(card.name, { ...card, role: group.role });
      }
    }
  }

  // Group by card type
  const byType = new Map<string, Array<CardSuggestion & { role: string }>>();
  for (const [, card] of allSuggestions) {
    const meta = cardMeta[card.name];
    const ty = meta ? primaryType(meta.typeLine) : 'Other';
    if (!byType.has(ty)) byType.set(ty, []);
    byType.get(ty)!.push(card);
  }
  const typeGroups = TYPE_ORDER.map(ty => ({ type: ty, cards: byType.get(ty) ?? [] })).filter(g => g.cards.length > 0);

  return (
    <>
      <div className="flex gap-6 h-[calc(100vh-140px)] max-h-[800px]">
        {/* Left: Suggestions */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Khoa's Suggestions</h2>
              {collectionOnly && (
                <span className="text-xs text-green-400 font-medium">📦 From your collection only</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {roles.length > 0 && !loading && (
                <button
                  type="button"
                  onClick={addAllAndFillLands}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 font-medium transition-colors"
                >
                  + Add All Suggestions
                </button>
              )}
              <button
                type="button"
                onClick={fetchSuggestions}
                disabled={loading}
                className="text-xs text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading…' : '↺ Refresh'}
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-sm">
                {/* Animated icon */}
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3 animate-pulse">🧙</div>
                  <div className="text-zinc-300 text-sm font-medium mb-1">Khoa is building your deck</div>
                  <div className="text-zinc-600 text-xs min-h-[1.25rem] transition-all">{LOAD_STAGES[loadStage]}</div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-700"
                    ref={el => { if (el) el.style.width = `${Math.round(((loadStage + 1) / LOAD_STAGES.length) * 90)}%`; }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-700">
                  <span>Analyzing</span>
                  <span>{Math.round(((loadStage + 1) / LOAD_STAGES.length) * 90)}%</span>
                  <span>Ready</span>
                </div>
              </div>
            </div>
          )}

          {!loading && loadError && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-xs">
                <div className="text-3xl mb-3">⚠️</div>
                <div className="text-zinc-400 text-sm font-medium mb-1">Khoa ran into a problem</div>
                <div className="text-zinc-600 text-xs mb-4">The AI couldn't generate suggestions right now. Try refreshing.</div>
                <button
                  type="button"
                  onClick={fetchSuggestions}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-5 py-2 text-sm transition-colors"
                >
                  ↺ Try Again
                </button>
              </div>
            </div>
          )}

          {!loading && !loadError && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {cmcLoading && typeGroups.length === 0 && (
                <div className="text-xs text-zinc-600 text-center py-2">Loading card data…</div>
              )}
              {typeGroups.map(group => (
                <div key={group.type} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="w-full flex items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedRole(prev => prev === group.type ? null : group.type)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <span className="font-semibold text-sm text-zinc-200">{group.type}</span>
                      <span className="text-xs text-zinc-600">{group.cards.length} cards</span>
                      <span className="text-zinc-600 text-xs ml-auto">{expandedRole === group.type ? '▲' : '▼'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const toAdd: Record<string, number> = {};
                        for (const card of group.cards) {
                          if (!(card.name in deck)) toAdd[card.name] = card.suggestedQuantity ?? 1;
                        }
                        setDeck(prev => ({ ...prev, ...toAdd }));
                      }}
                      className="ml-3 text-[10px] px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 transition-colors shrink-0"
                    >
                      + Add All
                    </button>
                  </div>

                  {expandedRole === group.type && (
                    <div className="border-t border-zinc-800">
                      {group.cards.map(card => {
                        const inDeck = deck[card.name] ?? 0;
                        const meta = cardMeta[card.name];
                        return (
                          <div key={card.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCard(card.name)}
                                  className="text-sm font-medium text-amber-400 hover:text-amber-300 hover:underline transition-colors text-left"
                                >
                                  {card.name}
                                </button>
                                {meta && (
                                  <>
                                    {meta.colors.slice(0, 3).map(c => (
                                      <span key={c} className={`text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${COLOR_PIPS[c] ?? 'bg-zinc-700 text-zinc-300'}`}>
                                        {c}
                                      </span>
                                    ))}
                                    {meta.power && meta.toughness && (
                                      <span className="text-[10px] text-zinc-500 font-mono shrink-0">{meta.power}/{meta.toughness}</span>
                                    )}
                                    {meta.manaCost && (
                                      <span className="text-[10px] text-zinc-600 font-mono shrink-0">{meta.manaCost.replace(/[{}]/g, '').replace(/\//g, '')}</span>
                                    )}
                                  </>
                                )}
                                <span className="text-[10px] text-zinc-700 shrink-0">{card.role}</span>
                                {card.likelyOwned && (
                                  <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-800 px-1 py-0.5 rounded shrink-0">Owned</span>
                                )}
                                <span className={`text-[10px] shrink-0 ${PRICE_TIER_COLORS[card.priceTier] ?? 'text-zinc-600'}`}>
                                  {card.priceTier}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-600 truncate mt-0.5">{card.reason}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {inDeck > 0 && (
                                <button type="button" onClick={() => removeCard(card.name)}
                                  className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs flex items-center justify-center">−</button>
                              )}
                              {inDeck > 0 && <span className="text-xs text-amber-400 w-4 text-center font-mono">{inDeck}</span>}
                              <button type="button" onClick={() => addCard(card.name, inDeck === 0 ? (card.suggestedQuantity ?? 1) : 1)}
                                className="w-6 h-6 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 text-xs flex items-center justify-center transition-colors">+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Deck */}
        <div className="w-64 shrink-0 flex flex-col">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-zinc-200">Your Deck</span>
              <span className={`text-sm font-mono ${totalCards === deckSize ? 'text-green-400' : totalCards > deckSize ? 'text-red-400' : 'text-zinc-400'}`}>
                {totalCards}/{deckSize}
              </span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${totalCards > deckSize ? 'bg-red-500 w-full' : totalCards === deckSize ? 'bg-green-500 w-full' : 'bg-amber-500'}`}
                ref={el => { if (el && totalCards < deckSize) el.style.width = `${progress}%`; }} />
            </div>
          </div>

          <div className="mb-3">
            {nonLandDeckCards.length > 0 && nonLandDeckCards.every(c => !(c.name in cardMeta)) ? (
              <div className="text-xs text-zinc-600 text-center py-3 animate-pulse">Fetching card data…</div>
            ) : (
              <ManaChart cards={nonLandDeckCards.map(c => ({ quantity: c.quantity, cmc: cardMeta[c.name]?.cmc ?? 0 }))} />
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5">
            {deckCards.map(({ name, quantity }) => (
              <div key={name} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-900 group">
                <span className="text-xs font-mono text-amber-400 w-4 shrink-0">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCard(name)}
                  className="text-xs text-zinc-300 hover:text-amber-400 hover:underline flex-1 min-w-0 truncate text-left transition-colors"
                >
                  {name}
                </button>
                <button type="button" onClick={() => removeCard(name)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 text-xs transition-opacity">×</button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onBack} className="flex-1 text-xs py-2 rounded-lg border border-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors">
              ← Back
            </button>
            <button
              type="button"
              onClick={() => onConfirm(deck)}
              disabled={totalCards === 0}
              title={totalCards === 0 ? 'Add cards before reviewing' : undefined}
              className="flex-1 text-xs py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 font-semibold transition-colors"
            >
              Review →
            </button>
          </div>
        </div>
      </div>

      {selectedCard && (
        <CardDetailModal cardName={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </>
  );
}
