'use client';

import { useState } from 'react';

interface ExtractedIntent {
  format: string;
  commanderName: string | null;
  commanderScryfallId: string | null;
  archetype: string | null;
  themes: string[];
  tribalType: string | null;
  budgetCents: number | null;
  psychographic: string | null;
  clarificationNeeded: string[];
  confidence: number;
}

interface CommanderSuggestion {
  name: string;
  reason: string;
  colorIdentity: string[];
  style: string;
}

const COMMANDER_FORMATS = new Set(['commander', 'brawl', 'oathbreaker', 'tiny_leaders']);

const COLOR_LABELS: Record<string, string> = { W: 'W', U: 'U', B: 'B', R: 'R', G: 'G' };

interface Props {
  sessionId: string | null;
  onExtracted: (intent: Partial<ExtractedIntent>) => void;
  onSwitchToGuided: () => void;
}

const CLARIFICATION_PROMPTS: Record<string, string> = {
  format: 'Which format are you building for? (e.g. Commander, Standard, Modern)',
  archetype: 'What\'s the main game plan? (e.g. Aggro, Control, Combo, Midrange)',
  commander: 'Do you have a specific commander in mind, or should Khoa suggest one?',
  themes: 'What themes or strategies interest you? (e.g. Tokens, Graveyard, Burn)',
};

export function NaturalLanguageEntry({ sessionId, onExtracted, onSwitchToGuided }: Props) {
  const [prompt, setPrompt] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedIntent | null>(null);
  const [clarificationIdx, setClarificationIdx] = useState(0);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [fullPrompt, setFullPrompt] = useState('');
  const [commanderSuggestions, setCommanderSuggestions] = useState<CommanderSuggestion[]>([]);
  const [suggestingCommanders, setSuggestingCommanders] = useState(false);

  async function handleExtract(text: string) {
    setExtracting(true);
    setFullPrompt(text);
    try {
      const res = await fetch('/api/deck-wizard/extract-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json() as ExtractedIntent;
      setExtracted(data);

      if ((data.clarificationNeeded?.length ?? 0) === 0) {
        // For commander formats with no commander specified, suggest one
        if (COMMANDER_FORMATS.has(data.format?.toLowerCase() ?? '') && !data.commanderName) {
          setSuggestingCommanders(true);
          try {
            const suggestRes = await fetch('/api/deck-wizard/commanders/suggest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ format: data.format, archetype: data.archetype, themes: data.themes, tribalType: data.tribalType, budgetCents: data.budgetCents }),
            });
            const suggestData = await suggestRes.json() as { commanders: CommanderSuggestion[] };
            setCommanderSuggestions(suggestData.commanders ?? []);
          } catch { /* proceed without suggestions */ }
          setSuggestingCommanders(false);
        } else {
          onExtracted(data);
        }
      }
    } catch {
      onSwitchToGuided();
    } finally {
      setExtracting(false);
    }
  }

  function pickCommander(name: string) {
    if (!extracted) return;
    onExtracted({ ...extracted, commanderName: name });
  }

  function handleClarify() {
    if (!extracted) return;
    const field = extracted.clarificationNeeded[clarificationIdx];
    const enhanced = `${fullPrompt}. ${field}: ${clarificationAnswer}`;

    if (clarificationIdx < extracted.clarificationNeeded.length - 1) {
      setClarificationIdx(i => i + 1);
      setClarificationAnswer('');
      setFullPrompt(enhanced);
    } else {
      handleExtract(enhanced);
    }
  }

  const currentClarificationField = extracted?.clarificationNeeded[clarificationIdx];
  const needsClarification = extracted && (extracted.clarificationNeeded?.length ?? 0) > 0;
  const needsCommander = extracted && !needsClarification && commanderSuggestions.length > 0;

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Describe Your Deck</h2>
        <p className="text-zinc-500">Tell Khoa what you want to build in plain English. Include format, strategy, budget, or anything else.</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-4">
        <div className="text-xs text-zinc-600 mb-2 font-medium">Example prompts:</div>
        {[
          'Atraxa superfriends Commander, $150 budget, I want to win with planeswalker ultimates',
          'Budget mono-red burn for Modern, as competitive as possible under $50',
          'Vampire tribal Commander, midrange gameplay, no specific budget',
        ].map(ex => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            className="block text-left text-xs text-zinc-500 hover:text-amber-400 py-0.5 transition-colors"
          >
            → {ex}
          </button>
        ))}
      </div>

      {needsCommander && (
        <div className="space-y-4">
          {extracted && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
              <div className="font-medium text-zinc-300 mb-2">Understood:</div>
              <div className="space-y-1 text-zinc-500">
                {extracted.format && <div>Format: <span className="text-zinc-300">{extracted.format}</span></div>}
                {extracted.archetype && <div>Archetype: <span className="text-zinc-300">{extracted.archetype}</span></div>}
                {extracted.themes.length > 0 && <div>Themes: <span className="text-zinc-300">{extracted.themes.join(', ')}</span></div>}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-amber-700/50 bg-amber-400/5 px-4 py-3">
            <p className="text-sm text-amber-300 font-semibold mb-1">Who's your commander?</p>
            <p className="text-xs text-zinc-500">You didn't specify a commander. Khoa suggests these based on your concept:</p>
          </div>
          {suggestingCommanders ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Finding commanders…</div>
          ) : (
            <div className="space-y-2">
              {commanderSuggestions.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => pickCommander(c.name)}
                  className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900 hover:border-amber-600 hover:bg-amber-400/5 p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-100 text-sm">{c.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{c.reason}</div>
                    </div>
                    <div className="shrink-0 flex gap-0.5 text-xs">
                      {c.colorIdentity.map(col => (
                        <span key={col} className="rounded px-1 py-0.5 bg-zinc-800 text-zinc-400 font-mono">
                          {COLOR_LABELS[col] ?? col}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-amber-600 mt-1">{c.style}</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => onExtracted(extracted!)}
                className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 py-2 transition-colors"
              >
                Skip — let Khoa decide →
              </button>
            </div>
          )}
        </div>
      )}
      {!needsCommander && !needsClarification && (
        <>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="I want to build a Commander deck focused on…"
            rows={4}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-600 transition-colors resize-none mb-4"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onSwitchToGuided}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              Switch to Guided Mode
            </button>
            <button
              type="button"
              onClick={() => handleExtract(prompt)}
              disabled={!prompt.trim() || extracting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold text-sm transition-colors"
            >
              {extracting ? 'Analyzing…' : 'Build This Deck →'}
            </button>
          </div>
        </>
      )}
      {!needsCommander && needsClarification && (
        <div className="space-y-4">
          {/* Summary of what was extracted */}
          {extracted && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
              <div className="font-medium text-zinc-300 mb-2">Understood so far:</div>
              <div className="space-y-1 text-zinc-500">
                {extracted.format && <div>Format: <span className="text-zinc-300">{extracted.format}</span></div>}
                {extracted.archetype && <div>Archetype: <span className="text-zinc-300">{extracted.archetype}</span></div>}
                {extracted.themes.length > 0 && <div>Themes: <span className="text-zinc-300">{extracted.themes.join(', ')}</span></div>}
                {extracted.budgetCents && <div>Budget: <span className="text-zinc-300">${(extracted.budgetCents / 100).toFixed(0)}</span></div>}
              </div>
            </div>
          )}

          {/* Clarification question */}
          <div className="rounded-xl border border-amber-700/50 bg-amber-400/5 p-4">
            <p className="text-sm text-amber-300 font-medium mb-3">
              {CLARIFICATION_PROMPTS[currentClarificationField ?? ''] ?? `Can you clarify: ${currentClarificationField}?`}
            </p>
            <input
              type="text"
              value={clarificationAnswer}
              onChange={e => setClarificationAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && clarificationAnswer.trim()) handleClarify(); }}
              placeholder="Your answer…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-600"
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => onExtracted(extracted!)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Skip clarifications
              </button>
              <button
                type="button"
                onClick={handleClarify}
                disabled={!clarificationAnswer.trim() || extracting}
                className="ml-auto rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold px-4 py-1.5 text-xs transition-colors"
              >
                {extracting ? 'Analyzing…' : clarificationIdx < (extracted?.clarificationNeeded.length ?? 1) - 1 ? 'Next →' : 'Build →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

