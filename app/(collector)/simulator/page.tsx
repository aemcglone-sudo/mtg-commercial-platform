'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { parseDeckFromText } from '@/lib/parse-deck';
import { computeBracketRating, BRACKET_META } from '@/lib/commander-bracket';
import { computeManaCurve, computeCardTypeCounts, COLOR_ORDER, COLOR_BG, COLOR_LABELS, type CardStats, type ColorKey } from '@/lib/deck-stats';
import type { ResolvedCard } from '@/app/api/simulator/resolve-cards/route';

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
  cards: Record<string, number>;
}

type Step = 'import' | 'analysis';

export default function SimulatorPage() {
  const [step, setStep] = useState<Step>('import');
  const [pasteText, setPasteText] = useState('');
  const [format, setFormat] = useState('commander');
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [selectedSavedDeckId, setSelectedSavedDeckId] = useState('');
  const [parseError, setParseError] = useState('');

  const [deckCards, setDeckCards] = useState<Record<string, number>>({});
  const [commander, setCommander] = useState('');

  const [cardData, setCardData] = useState<Map<string, CardStats & { imageUrl: string | null; priceUsd: number | null; oracleText: string | null; scryfallUri: string | null; rarity: string | null; name: string }>>(new Map());
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  const [combos, setCombos] = useState<{ cards: string[]; description: string }[]>([]);
  const [synergies, setSynergies] = useState<{ cards: string[]; description: string }[]>([]);
  const [winCondition, setWinCondition] = useState<string | null>(null);
  const [combosLoading, setCombosLoading] = useState(false);

  useEffect(() => {
    fetch('/api/decks')
      .then(r => r.ok ? r.json() : [])
      .then((d: SavedDeck[]) => setSavedDecks(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function handleParse(text: string) {
    setParseError('');
    const result = parseDeckFromText(text);
    if (!result || Object.keys(result.cards).length === 0) {
      setParseError('Could not find any cards in that text. Expected lines like "1 Sol Ring".');
      return;
    }
    setDeckCards(result.cards);
    // Best-effort commander guess: resolved after card data loads (see below)
    setCommander('');
    setStep('analysis');
  }

  function loadSavedDeck() {
    const deck = savedDecks.find(d => d.id === selectedSavedDeckId);
    if (!deck) return;
    setDeckCards(deck.cards);
    if (deck.format) setFormat(deck.format.toLowerCase());
    setCommander('');
    setStep('analysis');
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

        // Best-effort commander guess: a single Legendary Creature/Planeswalker among the parsed names
        if (!commander) {
          const candidates = cardNames.filter(n => {
            const tl = (map.get(n.toLowerCase())?.typeLine ?? '').toLowerCase();
            return tl.includes('legendary') && (tl.includes('creature') || tl.includes('planeswalker'));
          });
          if (candidates.length >= 1) setCommander(candidates[0]);
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

  function reset() {
    setStep('import');
    setDeckCards({});
    setCardData(new Map());
    setCombos([]);
    setSynergies([]);
    setWinCondition(null);
    setCommander('');
    setPasteText('');
    setParseError('');
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
                      <option key={d.id} value={d.id}>{d.name} ({Object.values(d.cards).reduce((s, q) => s + q, 0)} cards)</option>
                    ))}
                  </select>
                  <button type="button" onClick={loadSavedDeck} disabled={!selectedSavedDeckId}
                    className="px-4 py-2 rounded-lg font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap">
                    Load & Analyze
                  </button>
                </div>
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
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select value={commander} onChange={e => setCommander(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 max-w-56">
                  <option value="">No commander selected</option>
                  {cardNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-300">
                  Start over
                </button>
              </div>
            </div>

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
                  <p className="text-sm text-zinc-400">Mulligan & the 4-player game table are coming in a future update.</p>
                  <button type="button" disabled
                    className="px-5 py-2.5 rounded-xl font-semibold text-zinc-500 bg-zinc-800 cursor-not-allowed text-sm">
                    Continue to Game Table →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
