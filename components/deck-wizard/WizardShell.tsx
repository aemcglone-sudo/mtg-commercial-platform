'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { FormatSelector } from './FormatSelector';
import { CommanderSearch } from './CommanderSearch';
import { ArchetypeSelector } from './ArchetypeSelector';
import { ThemeSelector } from './ThemeSelector';
import { BudgetSelector } from './BudgetSelector';
import { CardSelectionPanel } from './CardSelectionPanel';
import { DeckReview } from './DeckReview';
import { NaturalLanguageEntry } from './NaturalLanguageEntry';

export interface ThemeRecs {
  themes: string[];
  archetypes: string[];
  tribal: string[];
  psychographics: string[];
  whyThese: string | null;
  winCondition: string | null;
}

export interface WizardState {
  format: string;
  commanderScryfallId: string | null;
  partnerScryfallId: string | null;
  commanderName: string | null;
  commanderColorIdentity: string[];
  archetype: string | null;
  themes: string[];
  tribalType: string | null;
  psychographic: string | null;
  budgetCents: number | null;
  cards: Record<string, number>;
  roleTargets: Record<string, number> | null;
  deckColors: string[]; // for non-commander formats: W/U/B/R/G chosen by user
  ownedCardNames: string[];
  currentStep: number;
  entryMode: 'guided' | 'natural_language';
  sessionId: string | null;
  themeRecs: ThemeRecs | null;
  commanderExplanation: string | null;
}

const INITIAL_STATE: WizardState = {
  format: 'commander',
  commanderScryfallId: null,
  partnerScryfallId: null,
  commanderName: null,
  commanderColorIdentity: [],
  archetype: null,
  themes: [],
  tribalType: null,
  psychographic: null,
  budgetCents: null,
  cards: {},
  roleTargets: null,
  deckColors: [],
  ownedCardNames: [],
  currentStep: 1,
  entryMode: 'guided',
  sessionId: null,
  themeRecs: null,
  commanderExplanation: null,
};

const STEPS = [
  { num: 1, label: 'Format' },
  { num: 2, label: 'Commander / Archetype' },
  { num: 3, label: 'Themes' },
  { num: 4, label: 'Budget' },
  { num: 5, label: 'Cards' },
  { num: 6, label: 'Review' },
];

const COMMANDER_FORMATS = new Set(['commander', 'brawl', 'oathbreaker', 'tiny_leaders']);

interface Props {
  initialState?: Partial<WizardState>;
  sessionId?: string;
}

export function WizardShell({ initialState, sessionId }: Props) {
  const [state, setState] = useState<WizardState>({
    ...INITIAL_STATE,
    ...initialState,
    sessionId: sessionId ?? null,
  });
  const [collectionOnly, setCollectionOnly] = useState(false);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const collectionFetched = useRef(false);

  const fetchCollection = useCallback(async () => {
    if (collectionFetched.current) return;
    collectionFetched.current = true;
    setCollectionLoading(true);
    try {
      const res = await fetch('/api/collection/names');
      if (res.ok) {
        const data = await res.json() as { names?: string[] };
        if (data.names?.length) {
          setState(prev => ({ ...prev, ownedCardNames: data.names! }));
          // Default to collection-only when the user has cards — they expect the deck to use what they own.
          setCollectionOnly(true);
        }
      }
    } catch { /* best effort */ }
    setCollectionLoading(false);
  }, []);

  // Eagerly fetch collection on mount so the toggle defaults correctly.
  useEffect(() => { fetchCollection(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleCollectionOnly = useCallback((value: boolean) => {
    setCollectionOnly(value);
    if (value) fetchCollection();
  }, [fetchCollection]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      // Persist to DB if we have a session
      if (next.sessionId) {
        fetch(`/api/deck-wizard/session/${next.sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: next.format,
            current_step: next.currentStep,
            archetype: next.archetype,
            themes: next.themes,
            tribal_type: next.tribalType,
            psychographic: next.psychographic,
            budget_cents: next.budgetCents,
            commander_scryfall_id: next.commanderScryfallId,
            partner_scryfall_id: next.partnerScryfallId,
            natural_language_prompt: null,
            wizard_state: {
              commanderName: next.commanderName,
              commanderColorIdentity: next.commanderColorIdentity,
              cards: next.cards,
              roleTargets: next.roleTargets,
            },
          }),
        }).catch(() => {});
      }
      return next;
    });
  }, []);

  const advance = useCallback((patch?: Partial<WizardState>) => {
    setState(prev => {
      const next = { ...prev, ...(patch ?? {}), currentStep: prev.currentStep + 1 };
      if (next.sessionId) {
        fetch(`/api/deck-wizard/session/${next.sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_step: next.currentStep }),
        }).catch(() => {});
      }
      return next;
    });
  }, []);

  const back = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: Math.max(1, prev.currentStep - 1) }));
  }, []);

  const isCommanderFormat = COMMANDER_FORMATS.has(state.format);
  const step2Label = isCommanderFormat ? 'Commander' : 'Archetype';

  const stepsForFormat = STEPS.map(s => s.num === 2 ? { ...s, label: step2Label } : s);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-zinc-100">Deck Wizard</h1>
            {state.commanderName && state.currentStep > 2 && (
              <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-500/30 rounded-full px-2.5 py-1">
                {state.commanderName.split(',')[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {stepsForFormat.map(step => (
              <div key={step.num} className="flex items-center gap-1">
                {step.num > 1 && <div className="w-4 h-px bg-zinc-700" />}
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  state.currentStep === step.num
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : state.currentStep > step.num
                      ? 'bg-green-900/30 text-green-500 border border-green-800'
                      : 'text-zinc-600'
                }`}>
                  {state.currentStep > step.num ? '✓' : step.num}
                  <span className="hidden sm:block">{step.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {state.entryMode === 'natural_language' ? (
          <NaturalLanguageEntry
            sessionId={state.sessionId}
            onExtracted={(extracted) => {
              update({
                ...extracted,
                entryMode: 'guided',
                currentStep: 5,
              });
            }}
            onSwitchToGuided={() => update({ entryMode: 'guided', currentStep: 1 })}
          />
        ) : (
          <>
            {state.currentStep === 1 && (
              <FormatSelector
                selected={state.format}
                collectionOnly={collectionOnly}
                onSelect={(format) => advance({ format })}
                onNaturalLanguage={() => update({ entryMode: 'natural_language' })}
                onToggleCollectionOnly={handleToggleCollectionOnly}
              />
            )}
            {state.currentStep === 2 && isCommanderFormat && (
              <CommanderSearch
                format={state.format}
                commanderExplanation={state.commanderExplanation}
                onCommanderHover={(name, oracleText) => {
                  setState(prev => ({ ...prev, commanderExplanation: null }));
                  const controller = new AbortController();
                  // Delay 5s so explain doesn't compete with theme-recs for Gemini quota
                  const abort = setTimeout(() => controller.abort(), 55000);
                  setTimeout(() => {
                  fetch('/api/deck-wizard/commanders/explain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commander: name, format: state.format, oracleText }),
                    signal: controller.signal,
                  })
                    .then(r => r.ok ? r.json() : null)
                    .then((d: { explanation: string | null } | null) => {
                      clearTimeout(abort);
                      setState(prev => ({ ...prev, commanderExplanation: d?.explanation ?? '(No description available)' }));
                    })
                    .catch(() => {
                      clearTimeout(abort);
                      setState(prev => ({ ...prev, commanderExplanation: '(Description unavailable — check the card text above)' }));
                    });
                  }, 5000);
                }}
                onSelect={(commander) => {
                  // Kick off theme recs immediately so they're ready when ThemeSelector mounts
                  fetch(`/api/deck-wizard/themes/recommend?commander=${encodeURIComponent(commander.name)}&format=${encodeURIComponent(state.format)}`)
                    .then(r => r.ok ? r.json() : null)
                    .then((recs: ThemeRecs | null) => {
                      if (recs) setState(prev => ({ ...prev, themeRecs: recs }));
                    })
                    .catch(() => {});
                  advance({
                    commanderScryfallId: commander.id,
                    commanderName: commander.name,
                    commanderColorIdentity: commander.colorIdentity,
                    cards: { [commander.name]: 1 },
                    commanderExplanation: state.commanderExplanation,
                  });
                }}
                onSkip={() => advance()}
                onBack={back}
              />
            )}
            {state.currentStep === 2 && !isCommanderFormat && (
              <ArchetypeSelector
                selected={state.archetype}
                onSelect={(archetype) => {
                  fetch(`/api/deck-wizard/themes/recommend?archetype=${encodeURIComponent(archetype)}&format=${encodeURIComponent(state.format)}`)
                    .then(r => r.ok ? r.json() : null)
                    .then((recs: ThemeRecs | null) => {
                      if (recs) setState(prev => ({ ...prev, themeRecs: recs }));
                    })
                    .catch(() => {});
                  advance({ archetype });
                }}
                onBack={back}
              />
            )}
            {state.currentStep === 3 && (
              <ThemeSelector
                format={state.format}
                commanderName={state.commanderName}
                selectedThemes={state.themes}
                selectedArchetype={state.archetype}
                tribalType={state.tribalType}
                recommendations={state.themeRecs}
                onConfirm={(themes, tribalType, psychographic, roleTargets, deckColors) => {
                  advance({ themes, tribalType, psychographic, roleTargets: roleTargets as Record<string, number> | null, deckColors: deckColors ?? [] });
                }}
                onBack={back}
              />
            )}
            {state.currentStep === 4 && (
              <BudgetSelector
                selected={state.budgetCents}
                onSelect={(budgetCents) => advance({ budgetCents })}
                onBack={back}
              />
            )}
            {state.currentStep === 5 && (
              <CardSelectionPanel
                sessionId={state.sessionId}
                format={state.format}
                commander={state.commanderName}
                commanderColorIdentity={state.commanderColorIdentity}
                archetype={state.archetype}
                themes={state.themes}
                tribalType={state.tribalType}
                psychographic={state.psychographic}
                budgetCents={state.budgetCents}
                roleTargets={state.roleTargets}
                deckColors={state.deckColors}
                ownedCardNames={state.ownedCardNames}
                collectionOnly={collectionOnly}
                initialCards={state.cards}
                onConfirm={(cards) => advance({ cards })}
                onBack={back}
              />
            )}
            {state.currentStep === 6 && (
              <DeckReview
                sessionId={state.sessionId}
                format={state.format}
                commander={state.commanderName}
                commanderColorIdentity={state.commanderColorIdentity}
                cards={state.cards}
                archetype={state.archetype}
                themes={state.themes}
                tribalType={state.tribalType}
                psychographic={state.psychographic}
                budgetCents={state.budgetCents}
                ownedCardNames={state.ownedCardNames}
                collectionOnly={collectionOnly}
                roleTargets={state.roleTargets}
                deckColors={state.deckColors}
                onBack={back}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
