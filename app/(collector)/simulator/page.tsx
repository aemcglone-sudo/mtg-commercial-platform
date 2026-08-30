'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { parseDeckFromText } from '@/lib/parse-deck';
import { computeBracketRating, BRACKET_META } from '@/lib/commander-bracket';
import { computeManaCurve, computeCardTypeCounts, COLOR_ORDER, COLOR_BG, COLOR_LABELS, type CardStats, type ColorKey } from '@/lib/deck-stats';
import { expandDeckToCards, shuffle } from '@/lib/deck-shuffle';
import type { ResolvedCard } from '@/app/api/simulator/resolve-cards/route';
import type { CommanderOption } from '@/app/api/simulator/commander-search/route';

const EXAMPLE_DECK = `1 Atraxa, Grand Unifier
1 Sol Ring
1 Arcane Signet
1 Command Tower
1 Cyclonic Rift
1 Smothering Tithe
1 Rhystic Study
1 Demonic Tutor
1 Vampiric Tutor
1 Toxic Deluge
1 Farewell
1 Swords to Plowshares
1 Path to Exile
1 Beast Within
1 Krosan Grip
1 Eternal Witness
1 Sun Titan
1 Solemn Simulacrum
1 Wood Elves
1 Kodama's Reach
1 Cultivate
1 Farseek
1 Skyshroud Claim
1 Nature's Lore
1 Elvish Rejuvenator
1 Ranger-Captain of Eos
1 Fierce Guardianship
1 Deflecting Swat
1 Teferi's Protection
1 Heroic Intervention
1 Blasphemous Act
1 Terminus
1 Wrath of God
1 Vindicate
1 Anguished Unmaking
1 Mortify
1 Utter End
1 Assassin's Trophy
1 Growth Spiral
1 Ponder
1 Brainstorm
1 Consecrated Sphinx
1 Mystic Confluence
1 Cryptic Command
1 Baleful Strix
1 Reveillark
1 Karmic Guide
1 Sun Titan
1 Sheoldred, the Apocalypse
1 Grave Titan
1 Massacre Wurm
1 Blood Artist
1 Zulaport Cutthroat
1 Elenda, the Dusk Rose
1 Skullclamp
1 Bloodchief's Thirst
1 Fatal Push
1 Go for the Throat
1 Doom Blade
1 Murder
1 Reflective Riposte
1 Deadly Rollick
1 Praetor's Grasp
1 Necropotence
1 Bolas's Citadel
1 The One Ring
1 Mana Crypt
1 Chrome Mox
1 Mana Vault
1 Lightning Greaves
1 Swiftfoot Boots
1 Lotus Petal
1 Signet Ring
1 Talisman of Progress
1 Fellwar Stone
1 Mind Stone
1 Wayfarer's Bauble
1 Burnished Hart
1 Plains
1 Plains
1 Plains
1 Island
1 Island
1 Island
1 Swamp
1 Swamp
1 Swamp
1 Forest
1 Forest
1 Forest
1 Hallowed Fountain
1 Watery Grave
1 Overgrown Tomb
1 Breeding Pool
1 Godless Shrine
1 Temple Garden
1 Sunken Hollow
1 Fetid Pools
1 Woodland Cemetery
1 Hinterland Harbor
1 Isolated Chapel
1 Canopy Vista`;

interface SavedDeck {
  id: string;
  name: string;
  format?: string;
  commander?: string | null;
  cards: Record<string, number>;
}

type Step = 'import' | 'analysis' | 'mulligan';
type MulliganPhase = 'deciding' | 'bottoming' | 'kept';

export default function SimulatorPage() {
  const [step, setStep] = useState<Step>('import');
  const [pasteText, setPasteText] = useState('');
  const [format, setFormat] = useState('commander');
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [selectedSavedDeckId, setSelectedSavedDeckId] = useState('');
  const [parseError, setParseError] = useState('');

  const [deckCards, setDeckCards] = useState<Record<string, number>>({});
  const [loadedDeckId, setLoadedDeckId] = useState<string | null>(null);
  const [saveDeckName, setSaveDeckName] = useState('');
  const [savingDeck, setSavingDeck] = useState(false);
  const [saveDeckError, setSaveDeckError] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [commander, setCommander] = useState('');
  const [commanderCardImg, setCommanderCardImg] = useState<string | null>(null);

  // Commander lookup for the paste-import path
  const [commanderQuery, setCommanderQuery] = useState('');
  const [commanderResults, setCommanderResults] = useState<CommanderOption[]>([]);
  const [commanderSearching, setCommanderSearching] = useState(false);

  const [cardData, setCardData] = useState<Map<string, CardStats & { imageUrl: string | null; priceUsd: number | null; oracleText: string | null; scryfallUri: string | null; rarity: string | null; name: string }>>(new Map());
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  const [combos, setCombos] = useState<{ cards: string[]; description: string }[]>([]);
  const [synergies, setSynergies] = useState<{ cards: string[]; description: string }[]>([]);
  const [winCondition, setWinCondition] = useState<string | null>(null);
  const [combosLoading, setCombosLoading] = useState(false);

  // Mulligan
  const [library, setLibrary] = useState<string[]>([]);
  const [hand, setHand] = useState<string[]>([]);
  const [mulliganCount, setMulliganCount] = useState(0);
  const [mulliganPhase, setMulliganPhase] = useState<MulliganPhase>('deciding');
  const [bottomSelection, setBottomSelection] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/decks')
      .then(r => r.ok ? r.json() : [])
      .then((d: SavedDeck[]) => setSavedDecks(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Debounced commander lookup as the user types
  useEffect(() => {
    if (commanderQuery.trim().length < 2) { setCommanderResults([]); return; }
    let cancelled = false;
    setCommanderSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/simulator/commander-search?q=${encodeURIComponent(commanderQuery)}`)
        .then(r => r.ok ? r.json() : { results: [] })
        .then((d: { results: CommanderOption[] }) => { if (!cancelled) setCommanderResults(d.results ?? []); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setCommanderSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [commanderQuery]);

  function pickCommander(option: CommanderOption) {
    setCommander(option.name);
    setCommanderCardImg(option.imageUrl);
    setCommanderQuery('');
    setCommanderResults([]);
  }

  // Commander lookup for a saved deck that doesn't have one stored yet (e.g. saved
  // before commander persistence existed) — setting it here saves it back to the
  // deck too, so it's remembered next time instead of asking again.
  const [savedDeckCommanderQuery, setSavedDeckCommanderQuery] = useState('');
  const [savedDeckCommanderResults, setSavedDeckCommanderResults] = useState<CommanderOption[]>([]);
  const [savedDeckCommanderSearching, setSavedDeckCommanderSearching] = useState(false);
  const [savingCommander, setSavingCommander] = useState(false);

  useEffect(() => {
    setSavedDeckCommanderQuery('');
    setSavedDeckCommanderResults([]);
  }, [selectedSavedDeckId]);

  useEffect(() => {
    if (savedDeckCommanderQuery.trim().length < 2) { setSavedDeckCommanderResults([]); return; }
    let cancelled = false;
    setSavedDeckCommanderSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/simulator/commander-search?q=${encodeURIComponent(savedDeckCommanderQuery)}`)
        .then(r => r.ok ? r.json() : { results: [] })
        .then((d: { results: CommanderOption[] }) => { if (!cancelled) setSavedDeckCommanderResults(d.results ?? []); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setSavedDeckCommanderSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [savedDeckCommanderQuery]);

  async function setCommanderForSavedDeck(deckId: string, option: CommanderOption) {
    setSavingCommander(true);
    try {
      await fetch(`/api/decks/${deckId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commander: option.name }),
      });
      setSavedDecks(prev => prev.map(d => d.id === deckId ? { ...d, commander: option.name } : d));
      setSavedDeckCommanderQuery('');
      setSavedDeckCommanderResults([]);
    } catch {
      // best effort — worst case they just have to pick it again next time
    } finally {
      setSavingCommander(false);
    }
  }

  function handleParse(text: string) {
    setParseError('');
    const result = parseDeckFromText(text);
    if (!result || Object.keys(result.cards).length === 0) {
      setParseError('Could not find any cards in that text. Expected lines like "1 Sol Ring".');
      return;
    }
    const cards = { ...result.cards };
    // If a commander was picked via search and isn't already in the pasted list, include it
    if (commander && !Object.keys(cards).some(n => n.toLowerCase() === commander.toLowerCase())) {
      cards[commander] = 1;
    }
    setDeckCards(cards);
    setLoadedDeckId(null); // pasted deck — not yet in My Decks
    setStep('analysis');
  }

  function loadSavedDeck() {
    const deck = savedDecks.find(d => d.id === selectedSavedDeckId);
    if (!deck) return;
    setDeckCards(deck.cards);
    if (deck.format) setFormat(deck.format.toLowerCase());
    // A saved deck already carries its own commander — use it directly rather
    // than re-guessing or requiring the user to pick it again.
    setCommander(deck.commander ?? '');
    setCommanderCardImg(null);
    setLoadedDeckId(deck.id); // already in My Decks — no need to offer saving it again
    setStep('analysis');
  }

  async function saveDeckToMyDecks() {
    if (!saveDeckName.trim()) { setSaveDeckError('Give the deck a name first.'); return; }
    setSavingDeck(true);
    setSaveDeckError('');
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveDeckName.trim(),
          format: format.charAt(0).toUpperCase() + format.slice(1),
          commander: commander || undefined,
          cards: deckCards,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveDeckError(data.error ?? 'Failed to save deck'); return; }
      setLoadedDeckId(data.id);
      setSavedDecks(prev => [{ id: data.id, name: data.name, format: data.format, commander: data.commander, cards: deckCards }, ...prev]);
      setShowSaveForm(false);
    } catch {
      setSaveDeckError('Something went wrong. Please try again.');
    } finally {
      setSavingDeck(false);
    }
  }

  const cardNames = useMemo(() => Object.keys(deckCards), [deckCards]);
  const totalCards = useMemo(() => Object.values(deckCards).reduce((s, q) => s + q, 0), [deckCards]);

  // Resolve full Scryfall data for the deck once we enter analysis
  useEffect(() => {
    if (step !== 'analysis' || cardNames.length === 0) return;
    let cancelled = false;
    setLoadingAnalysis(true);
    setAnalysisError('');
    fetch('/api/simulator/resolve-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: cardNames }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Lookup failed')))
      .then((d: { cards: Record<string, ResolvedCard> }) => {
        if (cancelled) return;
        const map = new Map<string, CardStats & ResolvedCard>();
        for (const [key, card] of Object.entries(d.cards)) map.set(key, card);
        setCardData(map);

        // Best-effort commander guess — only when there's exactly one legendary
        // creature/planeswalker in the list. Most Commander decks run several
        // legendary creatures as support pieces, not just the commander, so
        // picking "the first one found" is confidently wrong most of the time.
        // Ambiguous or empty cases are left for the user to pick explicitly.
        if (!commander) {
          const candidates = cardNames.filter(n => {
            const tl = (map.get(n.toLowerCase())?.typeLine ?? '').toLowerCase();
            return tl.includes('legendary') && (tl.includes('creature') || tl.includes('planeswalker'));
          });
          if (candidates.length === 1) setCommander(candidates[0]);
        }
      })
      .catch(() => { if (!cancelled) setAnalysisError('Failed to look up card data. Please try again.'); })
      .finally(() => { if (!cancelled) setLoadingAnalysis(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cardNames.join(',')]);

  // Combo/synergy detection (needs 10+ cards)
  useEffect(() => {
    if (step !== 'analysis' || cardNames.length < 10) return;
    let cancelled = false;
    setCombosLoading(true);
    fetch('/api/deck-wizard/detect-combos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: cardNames, commander: commander || undefined, format }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((d: { combos?: typeof combos; synergies?: typeof synergies; winCondition?: string } | null) => {
        if (cancelled || !d) return;
        setCombos(d.combos ?? []);
        setSynergies(d.synergies ?? []);
        setWinCondition(d.winCondition ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCombosLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cardNames.join(','), commander, format]);

  const manaCurve = useMemo(() => computeManaCurve(deckCards, cardData), [deckCards, cardData]);
  const cardTypeCounts = useMemo(() => computeCardTypeCounts(deckCards, cardData), [deckCards, cardData]);
  const bracketRating = useMemo(() => computeBracketRating(cardNames, format, combos.length), [cardNames, format, combos.length]);

  const commanderCard = commander ? cardData.get(commander.toLowerCase()) : undefined;

  const [hoveredDeckCard, setHoveredDeckCard] = useState<{ name: string; imageUrl: string | null } | null>(null);

  const DECK_LIST_TYPE_ORDER = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Battle', 'Other', 'Land'];

  function colorKeyForColors(colors: string[]): ColorKey {
    if (colors.length === 0) return 'C';
    if (colors.length > 1) return 'M';
    return colors[0] as ColorKey;
  }

  const deckColumns = useMemo(() => {
    const groups: Record<string, { name: string; qty: number; colors: string[] }[]> = {};
    for (const t of DECK_LIST_TYPE_ORDER) groups[t] = [];
    for (const [name, qty] of Object.entries(deckCards)) {
      if (commander && name.toLowerCase() === commander.toLowerCase()) continue; // shown in its own column
      const data = cardData.get(name.toLowerCase());
      const tl = (data?.typeLine ?? '').toLowerCase();
      let bucket = 'Other';
      if (tl.includes('creature')) bucket = 'Creature';
      else if (tl.includes('instant')) bucket = 'Instant';
      else if (tl.includes('sorcery')) bucket = 'Sorcery';
      else if (tl.includes('enchantment')) bucket = 'Enchantment';
      else if (tl.includes('artifact')) bucket = 'Artifact';
      else if (tl.includes('planeswalker')) bucket = 'Planeswalker';
      else if (tl.includes('battle')) bucket = 'Battle';
      else if (tl.includes('land')) bucket = 'Land';
      groups[bucket].push({ name, qty, colors: data?.colors ?? [] });
    }
    for (const t of Object.keys(groups)) groups[t].sort((a, b) => a.name.localeCompare(b.name));
    return DECK_LIST_TYPE_ORDER.filter(t => groups[t].length > 0).map(t => ({ type: t, cards: groups[t] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckCards, cardData, commander]);

  function cardImgFallback(name: string): string {
    return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  }

  function reset() {
    setStep('import');
    setDeckCards({});
    setCardData(new Map());
    setCombos([]);
    setSynergies([]);
    setWinCondition(null);
    setCommander('');
    setCommanderCardImg(null);
    setCommanderQuery('');
    setCommanderResults([]);
    setPasteText('');
    setParseError('');
    setLibrary([]);
    setHand([]);
    setMulliganCount(0);
    setMulliganPhase('deciding');
    setBottomSelection(new Set());
    setLoadedDeckId(null);
    setSaveDeckName('');
    setSaveDeckError('');
    setShowSaveForm(false);
  }

  // ── Mulligan (London mulligan: always draw 7, bottom N cards equal to mulligans taken) ──

  function startMulligan() {
    const pool = shuffle(expandDeckToCards(deckCards, commander));
    setLibrary(pool.slice(7));
    setHand(pool.slice(0, 7));
    setMulliganCount(0);
    setMulliganPhase('deciding');
    setBottomSelection(new Set());
    setStep('mulligan');
  }

  function takeMulligan() {
    const pool = shuffle([...hand, ...library]);
    setLibrary(pool.slice(7));
    setHand(pool.slice(0, 7));
    setMulliganCount(c => c + 1);
    setBottomSelection(new Set());
  }

  function keepHand() {
    if (mulliganCount === 0) {
      setMulliganPhase('kept');
    } else {
      setMulliganPhase('bottoming');
    }
  }

  function toggleBottomCard(index: number) {
    setBottomSelection(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else if (next.size < mulliganCount) next.add(index);
      return next;
    });
  }

  function confirmBottoming() {
    if (bottomSelection.size !== mulliganCount) return;
    const bottomed = [...bottomSelection].map(i => hand[i]);
    const keptHand = hand.filter((_, i) => !bottomSelection.has(i));
    setLibrary(prev => [...prev, ...bottomed]);
    setHand(keptHand);
    setMulliganPhase('kept');
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Commander Simulator</h1>
          <p className="text-sm text-zinc-500 mt-1">Import a deck and see its power level, mana curve, and win conditions before you play.</p>
        </div>

        {step === 'import' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Paste a decklist</h2>
                <button type="button" onClick={() => setPasteText(EXAMPLE_DECK)} className="text-xs text-amber-400 hover:text-amber-300">
                  Try an example deck
                </button>
              </div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'1 Sol Ring\n1 Command Tower\n1 Atraxa, Grand Unifier\n...'}
                rows={8}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
              />
              <div className="flex items-center gap-3">
                <label className="text-xs text-zinc-500">Format</label>
                <select value={format} onChange={e => setFormat(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500">
                  <option value="commander">Commander</option>
                  <option value="brawl">Brawl</option>
                  <option value="oathbreaker">Oathbreaker</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {(format === 'commander' || format === 'brawl' || format === 'oathbreaker') && (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Commander</label>
                  {commander ? (
                    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2">
                      {commanderCardImg && <img src={commanderCardImg} alt={commander} className="w-8 rounded" />}
                      <span className="text-sm text-amber-400 flex-1">{commander}</span>
                      <button type="button" onClick={() => { setCommander(''); setCommanderCardImg(null); }} className="text-xs text-zinc-500 hover:text-zinc-300">
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={commanderQuery}
                        onChange={e => setCommanderQuery(e.target.value)}
                        placeholder="Search for a legendary creature…"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                      {commanderSearching && <p className="text-xs text-zinc-600 mt-1">Searching…</p>}
                      {commanderResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                          {commanderResults.map(opt => (
                            <button
                              key={opt.scryfallId}
                              type="button"
                              onClick={() => pickCommander(opt)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
                            >
                              {opt.imageUrl && <img src={opt.imageUrl} alt={opt.name} className="w-8 rounded shrink-0" />}
                              <div className="min-w-0">
                                <p className="text-sm text-zinc-200 truncate">{opt.name}</p>
                                <p className="text-xs text-zinc-500 truncate">{opt.typeLine}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {parseError && <p className="text-xs text-red-400">{parseError}</p>}
              <button type="button" onClick={() => handleParse(pasteText)} disabled={!pasteText.trim()}
                className="px-5 py-2.5 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                Analyze Deck
              </button>
            </div>

            {savedDecks.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold">Or load a saved deck</h2>
                <div className="flex items-center gap-3">
                  <select value={selectedSavedDeckId} onChange={e => setSelectedSavedDeckId(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500">
                    <option value="">Choose a deck…</option>
                    {savedDecks.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({Object.values(d.cards).reduce((s, q) => s + q, 0)} cards{d.commander ? ` — Commander: ${d.commander}` : ''})
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={loadSavedDeck} disabled={!selectedSavedDeckId}
                    className="px-4 py-2 rounded-lg font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap">
                    Load & Analyze
                  </button>
                </div>
                {(() => {
                  const selected = savedDecks.find(d => d.id === selectedSavedDeckId);
                  if (!selected) return null;
                  if (selected.commander) {
                    return <p className="text-xs text-amber-400">Commander: {selected.commander} — will be used automatically.</p>;
                  }
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-600">
                        No commander saved with this deck yet — search to set one{savingCommander ? ' (saving…)' : ''}:
                      </p>
                      <div className="relative max-w-sm">
                        <input
                          type="text"
                          value={savedDeckCommanderQuery}
                          onChange={e => setSavedDeckCommanderQuery(e.target.value)}
                          placeholder="Search for a legendary creature…"
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                        />
                        {savedDeckCommanderSearching && <p className="text-xs text-zinc-600 mt-1">Searching…</p>}
                        {savedDeckCommanderResults.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                            {savedDeckCommanderResults.map(opt => (
                              <button
                                key={opt.scryfallId}
                                type="button"
                                onClick={() => setCommanderForSavedDeck(selected.id, opt)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
                              >
                                {opt.imageUrl && <img src={opt.imageUrl} alt={opt.name} className="w-8 rounded shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-sm text-zinc-200 truncate">{opt.name}</p>
                                  <p className="text-xs text-zinc-500 truncate">{opt.typeLine}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {step === 'analysis' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                {commanderCard?.imageUrl && (
                  <img src={commanderCard.imageUrl} alt={commander} className="w-16 rounded-lg border border-zinc-700" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{totalCards} cards</span>
                    <span className="text-sm text-zinc-500">({cardNames.length} unique)</span>
                  </div>
                  {commander && <p className="text-sm text-amber-400">Commander: {commander}</p>}
                  {!commander && !loadingAnalysis && (format === 'commander' || format === 'brawl' || format === 'oathbreaker') && (
                    <p className="text-sm text-red-400">⚠ No commander selected — pick one →</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select value={commander} onChange={e => setCommander(e.target.value)}
                  className={`bg-zinc-800 border rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 max-w-56 ${
                    !commander && (format === 'commander' || format === 'brawl' || format === 'oathbreaker') ? 'border-red-700' : 'border-zinc-700'
                  }`}>
                  <option value="">No commander selected</option>
                  {cardNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-300">
                  Start over
                </button>
              </div>
            </div>

            {loadedDeckId === null && !showSaveForm && (
              <button type="button" onClick={() => { setShowSaveForm(true); setSaveDeckName(commander ? `${commander} Deck` : 'New Deck'); }}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors">
                💾 Save to My Decks
              </button>
            )}
            {loadedDeckId !== null && (
              <p className="text-xs text-green-400">✓ Saved to My Decks</p>
            )}
            {showSaveForm && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  value={saveDeckName}
                  onChange={e => setSaveDeckName(e.target.value)}
                  placeholder="Deck name"
                  className="flex-1 min-w-48 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
                <button type="button" onClick={saveDeckToMyDecks} disabled={savingDeck}
                  className="px-4 py-2 rounded-lg font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-colors text-sm">
                  {savingDeck ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowSaveForm(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
                  Cancel
                </button>
                {saveDeckError && <p className="text-xs text-red-400 w-full">{saveDeckError}</p>}
              </div>
            )}

            {loadingAnalysis && <p className="text-sm text-zinc-500">Looking up {cardNames.length} cards…</p>}
            {analysisError && <p className="text-sm text-red-400">{analysisError}</p>}

            {totalCards !== 100 && format !== 'other' && (
              <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-lg px-3 py-2">
                ⚠ This deck has {totalCards} cards — Commander decks are normally exactly 100 (including the commander).
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5">
                {/* Mana Curve */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-100 mb-4">Mana Curve</h3>
                  {manaCurve.every(b => b.total === 0) ? (
                    <p className="text-xs text-zinc-600">{loadingAnalysis ? 'Loading card data…' : 'No non-land cards found.'}</p>
                  ) : (
                    <>
                      <div className="flex items-end gap-1.5 mb-2">
                        {manaCurve.map((bucket, i) => {
                          const max = Math.max(...manaCurve.map(b => b.total), 1);
                          const totalPx = Math.round((bucket.total / max) * 88);
                          return (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1">
                              <span className="text-[10px] text-zinc-400 font-medium" style={{ visibility: bucket.total > 0 ? 'visible' : 'hidden' }}>{bucket.total}</span>
                              <div className="w-full rounded-t overflow-hidden flex flex-col-reverse" style={{ height: `${bucket.total > 0 ? Math.max(totalPx, 4) : 0}px` }}>
                                {COLOR_ORDER.map(c => bucket[c] > 0 && (
                                  <div key={c} style={{ height: `${Math.round((bucket[c] / bucket.total) * Math.max(totalPx, 4))}px`, backgroundColor: COLOR_BG[c] }} />
                                ))}
                              </div>
                              <span className="text-[10px] text-zinc-500">{i === 7 ? '7+' : i}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                        {COLOR_ORDER.map(c => {
                          const total = manaCurve.reduce((s, b) => s + b[c], 0);
                          if (total === 0) return null;
                          return (
                            <span key={c} className="flex items-center gap-1 text-[10px] text-zinc-400">
                              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_BG[c as ColorKey] }} />
                              {COLOR_LABELS[c as ColorKey]} ({total})
                            </span>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Card Types */}
                {cardTypeCounts.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-100 mb-3">Card Types</h3>
                    <table className="w-full text-xs">
                      <tbody>
                        {cardTypeCounts.map(({ type, count }) => {
                          const total = cardTypeCounts.reduce((s, r) => s + r.count, 0);
                          const pct = Math.round((count / total) * 100);
                          return (
                            <tr key={type} className="border-b border-zinc-800 last:border-0">
                              <td className="py-1.5 text-zinc-400 w-28">{type}</td>
                              <td className="py-1.5 text-zinc-100 font-semibold w-8 text-right">{count}</td>
                              <td className="py-1.5 pl-3 w-full">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                                    <div className="bg-amber-500/70 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-zinc-600 w-7 text-right">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Bracket Rating */}
                {bracketRating && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-100 mb-3">Commander Bracket</h3>
                    {(() => {
                      const { bracket, reasons, gameChangersInDeck } = bracketRating;
                      const meta = BRACKET_META[bracket];
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            {[1, 2, 3, 4, 5].map(b => (
                              <div key={b} className={`flex-1 h-2 rounded-full transition-colors ${b <= bracket ? meta.bg.replace('/40', '') : 'bg-zinc-800'}`} />
                            ))}
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-black ${meta.color}`}>{bracket}</span>
                            <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                          </div>
                          <p className="text-xs text-zinc-500">{meta.desc}</p>
                          {reasons.length > 0 && (
                            <ul className="space-y-0.5">
                              {reasons.map((r, i) => <li key={i} className="text-xs text-zinc-400">• {r}</li>)}
                            </ul>
                          )}
                          {gameChangersInDeck.length > 0 && (
                            <div className="pt-2 border-t border-zinc-800">
                              <p className="text-[11px] text-zinc-500 mb-1">Game Changers in this deck:</p>
                              <div className="flex flex-wrap gap-1">
                                {gameChangersInDeck.map(n => (
                                  <span key={n} className="text-[10px] px-1.5 py-0.5 rounded border border-amber-800 bg-amber-950 text-amber-400">{n}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {/* Win Condition / Combos / Synergies */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-zinc-100">Deck Identity</h3>
                  {combosLoading && <p className="text-xs text-zinc-600">Analyzing win conditions and synergies…</p>}
                  {!combosLoading && cardNames.length < 10 && (
                    <p className="text-xs text-zinc-600">Add at least 10 cards to see combo/synergy analysis.</p>
                  )}
                  {winCondition && (
                    <div>
                      <p className="text-[11px] text-zinc-500 mb-1">Win Condition</p>
                      <p className="text-sm text-zinc-300">{winCondition}</p>
                    </div>
                  )}
                  {combos.length > 0 && (
                    <div>
                      <p className="text-[11px] text-zinc-500 mb-1.5">Combos</p>
                      <div className="space-y-2">
                        {combos.map((c, i) => (
                          <div key={i} className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                            <p className="font-semibold text-amber-400">{c.cards.join(' + ')}</p>
                            <p className="text-zinc-400 mt-0.5">{c.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {synergies.length > 0 && (
                    <div>
                      <p className="text-[11px] text-zinc-500 mb-1.5">Key Synergies</p>
                      <div className="space-y-2">
                        {synergies.map((s, i) => (
                          <div key={i} className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
                            <p className="font-semibold text-blue-400">{s.cards.join(' + ')}</p>
                            <p className="text-zinc-400 mt-0.5">{s.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center space-y-2">
                  <p className="text-sm text-zinc-400">Ready to see your opening hand? The full 4-player game table is coming in a future update.</p>
                  <button type="button" onClick={startMulligan} disabled={cardNames.length === 0}
                    className="px-5 py-2.5 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                    Draw Opening Hand →
                  </button>
                </div>
              </div>
            </div>

            {/* Deck List */}
            {(commander || deckColumns.length > 0) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-100 mb-4">Deck List</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {commander && (
                    <div className="shrink-0 w-40">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">Commander</p>
                      <button
                        type="button"
                        onMouseEnter={() => setHoveredDeckCard({ name: commander, imageUrl: commanderCard?.imageUrl ?? null })}
                        onMouseLeave={() => setHoveredDeckCard(null)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded border-l-4 bg-zinc-950 hover:bg-zinc-800 transition-colors truncate"
                        style={{ borderLeftColor: COLOR_BG[colorKeyForColors(commanderCard?.colors ?? [])] }}
                      >
                        <span className="truncate text-zinc-200">{commander}</span>
                      </button>
                    </div>
                  )}
                  {deckColumns.map(col => (
                    <div key={col.type} className="shrink-0 w-40 space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">
                        {col.type} ({col.cards.reduce((s, c) => s + c.qty, 0)})
                      </p>
                      {col.cards.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          onMouseEnter={() => setHoveredDeckCard({ name: c.name, imageUrl: cardData.get(c.name.toLowerCase())?.imageUrl ?? null })}
                          onMouseLeave={() => setHoveredDeckCard(null)}
                          className="w-full text-left text-xs px-2 py-1.5 rounded border-l-4 bg-zinc-950 hover:bg-zinc-800 transition-colors truncate flex items-center justify-between gap-1"
                          style={{ borderLeftColor: COLOR_BG[colorKeyForColors(c.colors)] }}
                        >
                          <span className="truncate text-zinc-200">{c.name}</span>
                          {c.qty > 1 && <span className="text-zinc-500 shrink-0">×{c.qty}</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'mulligan' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold">Opening Hand</h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {mulliganCount === 0 ? 'No mulligans taken' : `Mulligan${mulliganCount > 1 ? 'ed' : ''} ${mulliganCount} time${mulliganCount > 1 ? 's' : ''}`}
                  {mulliganPhase === 'bottoming' && ` — put ${mulliganCount} card${mulliganCount > 1 ? 's' : ''} on the bottom`}
                </p>
              </div>
              <button type="button" onClick={() => setStep('analysis')} className="text-xs text-zinc-500 hover:text-zinc-300">
                ← Back to Analysis
              </button>
            </div>

            {mulliganPhase === 'bottoming' && (
              <p className="text-xs text-amber-500 bg-amber-950/30 border border-amber-900 rounded-lg px-3 py-2">
                Select {mulliganCount} card{mulliganCount > 1 ? 's' : ''} to put on the bottom of your library ({bottomSelection.size}/{mulliganCount} selected).
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {hand.map((name, i) => {
                const img = cardData.get(name.toLowerCase())?.imageUrl ?? cardImgFallback(name);
                const selected = bottomSelection.has(i);
                const selectable = mulliganPhase === 'bottoming';
                return (
                  <button
                    key={`${name}-${i}`}
                    type="button"
                    disabled={!selectable}
                    onClick={() => toggleBottomCard(i)}
                    onMouseEnter={() => setHoveredDeckCard({ name, imageUrl: cardData.get(name.toLowerCase())?.imageUrl ?? null })}
                    onMouseLeave={() => setHoveredDeckCard(null)}
                    className={`w-36 rounded-lg border-2 transition-all overflow-hidden ${
                      selected ? 'border-amber-400 opacity-50' : 'border-transparent'
                    } ${selectable ? 'cursor-pointer hover:border-zinc-600' : 'cursor-default'}`}
                  >
                    <img src={img} alt={name} className="w-full rounded" />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {mulliganPhase === 'deciding' && (
                <>
                  <button type="button" onClick={keepHand}
                    className="px-5 py-2.5 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors text-sm">
                    Keep Hand
                  </button>
                  <button type="button" onClick={takeMulligan}
                    className="px-5 py-2.5 rounded-xl font-semibold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-sm">
                    Mulligan
                  </button>
                </>
              )}
              {mulliganPhase === 'bottoming' && (
                <button type="button" onClick={confirmBottoming} disabled={bottomSelection.size !== mulliganCount}
                  className="px-5 py-2.5 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                  Confirm & Keep Hand
                </button>
              )}
              {mulliganPhase === 'kept' && (
                <>
                  <span className="text-sm text-green-400 font-medium">✓ Hand kept</span>
                  <button type="button" onClick={startMulligan}
                    className="px-4 py-2 rounded-lg font-semibold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-sm">
                    Draw a New Hand
                  </button>
                </>
              )}
            </div>

            {mulliganPhase === 'kept' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center space-y-2">
                <p className="text-sm text-zinc-400">The full 4-player game table is coming in a future update.</p>
                <button type="button" disabled
                  className="px-5 py-2.5 rounded-xl font-semibold text-zinc-500 bg-zinc-800 cursor-not-allowed text-sm">
                  Continue to Game Table →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card image preview on hover */}
      {hoveredDeckCard && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <img
            src={hoveredDeckCard.imageUrl ?? cardImgFallback(hoveredDeckCard.name)}
            alt={hoveredDeckCard.name}
            className="w-56 rounded-xl border border-zinc-700 shadow-2xl"
          />
        </div>
      )}
    </main>
  );
}
