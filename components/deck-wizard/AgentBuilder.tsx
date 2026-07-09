'use client';

import { useEffect, useRef, useState } from 'react';

interface AgentEvent {
  type: 'status' | 'thinking' | 'tool_call' | 'tool_result' | 'finalizing' | 'complete' | 'error';
  text?: string;
  tool?: string;
  input?: unknown;
  summary?: string;
  deck?: Record<string, number>;
  strategy?: string;
  message?: string;
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
  ownedCardNames: string[];
  collectionOnly: boolean;
  onComplete: (cards: Record<string, number>) => void;
  onBack: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  search_cards: 'Searching cards',
  get_card: 'Looking up card',
  get_commander_staples: 'Researching commander',
  check_deck: 'Checking deck',
  finalize_deck: 'Finalizing deck',
};

const BASIC_LANDS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes',
  'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);

export function AgentBuilder({
  sessionId, format, commander, commanderColorIdentity, archetype, themes,
  tribalType, psychographic, budgetCents, ownedCardNames, collectionOnly, onComplete, onBack
}: Props) {
  const [feed, setFeed] = useState<{ id: number; event: AgentEvent }[]>([]);
  const [deck, setDeck] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running');
  const [errorMsg, setErrorMsg] = useState('');
  const [strategy, setStrategy] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);
  const eventIdRef = useRef(0);

  const addEvent = (event: AgentEvent) => {
    setFeed(prev => [...prev, { id: eventIdRef.current++, event }]);
  };

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [feed]);

  useEffect(() => {
    let aborted = false;

    async function run() {
      const res = await fetch('/api/deck-wizard/agent-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, format, commander, commanderColorIdentity, archetype, themes,
          tribalType, psychographic, budgetCents, ownedCardNames, collectionOnly,
        }),
      });

      if (!res.ok || !res.body) {
        setStatus('error');
        setErrorMsg('Failed to connect to agent.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as AgentEvent;
            addEvent(event);

            if (event.type === 'complete' && event.deck) {
              setDeck(event.deck);
              setStrategy(event.strategy ?? '');
              setStatus('done');
            } else if (event.type === 'error') {
              setStatus('error');
              setErrorMsg(event.message ?? 'Unknown error');
            }
          } catch { /* malformed event */ }
        }
      }
    }

    run().catch(e => {
      if (!aborted) {
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Connection failed');
      }
    });

    return () => { aborted = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCards = Object.values(deck).reduce((s, q) => s + q, 0);
  const nonLands = Object.entries(deck).filter(([n]) => !BASIC_LANDS.has(n));
  const lands = Object.entries(deck).filter(([n]) => BASIC_LANDS.has(n));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-100 mb-1">Building Your Deck</h2>
        <p className="text-zinc-500 text-sm">
          {commander ? `${commander} · ` : ''}{format} · Khoa is researching and building in real time
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent feed */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col h-[70vh]">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            {status === 'running' && (
              <svg className="w-3.5 h-3.5 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
            {status === 'done' && <span className="w-3.5 h-3.5 text-green-400 text-sm">✓</span>}
            {status === 'error' && <span className="w-3.5 h-3.5 text-red-400 text-sm">✗</span>}
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              {status === 'running' ? 'Khoa is working…' : status === 'done' ? 'Build complete' : 'Error'}
            </span>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
            {feed.map(({ id, event }) => {
              if (event.type === 'status' || event.type === 'finalizing') {
                return (
                  <div key={id} className="text-zinc-500 text-xs italic">{event.text}</div>
                );
              }
              if (event.type === 'thinking' && event.text) {
                return (
                  <div key={id} className="text-zinc-300 leading-relaxed">{event.text}</div>
                );
              }
              if (event.type === 'tool_call') {
                const inp = event.input && typeof event.input === 'object' ? event.input as Record<string, string> : null;
                const toolDetail = event.tool === 'search_cards' ? inp?.query : event.tool === 'get_card' ? inp?.name : null;
                return (
                  <div key={id} className="flex items-center gap-2 text-xs text-amber-400/80">
                    <span className="shrink-0">→</span>
                    <span>{TOOL_LABELS[event.tool ?? ''] ?? event.tool}</span>
                    {toolDetail && <span className="text-zinc-600 truncate">{toolDetail}</span>}
                  </div>
                );
              }
              if (event.type === 'tool_result') {
                return (
                  <div key={id} className="text-xs text-zinc-500 pl-4">{event.summary}</div>
                );
              }
              if (event.type === 'error') {
                return (
                  <div key={id} className="text-xs text-red-400">{event.message}</div>
                );
              }
              return null;
            })}

            {status === 'running' && (
              <div className="flex gap-1 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
              </div>
            )}
          </div>
        </div>

        {/* Growing deck list */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col h-[70vh]">
          <div className="px-4 py-3 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Deck {totalCards > 0 ? `· ${totalCards} cards` : ''}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {totalCards === 0 && status === 'running' && (
              <div className="text-zinc-600 text-xs text-center py-8 animate-pulse">Cards will appear here as Khoa builds…</div>
            )}

            {nonLands.length > 0 && (
              <div className="space-y-0.5 mb-3">
                {nonLands.sort((a, b) => a[0].localeCompare(b[0])).map(([name, qty]) => (
                  <div key={name} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="text-amber-400 font-mono w-4 shrink-0 text-right">{qty}</span>
                    <span className="text-zinc-300 truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}

            {lands.length > 0 && (
              <>
                <div className="text-[10px] text-zinc-600 font-medium py-1 border-t border-zinc-800 mb-1">Lands ({lands.reduce((s, [, q]) => s + q, 0)})</div>
                {lands.map(([name, qty]) => (
                  <div key={name} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="text-amber-400 font-mono w-4 shrink-0 text-right">{qty}</span>
                    <span className="text-zinc-500 truncate">{name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Strategy + actions */}
      {status === 'done' && (
        <div className="mt-6 space-y-4">
          {strategy && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Strategy</div>
              <p className="text-sm text-zinc-300 leading-relaxed">{strategy}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onComplete(deck)}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold text-sm transition-colors"
            >
              Review & Save Deck →
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-red-800/40 bg-red-900/10 px-4 py-3 text-sm text-red-400">
            {errorMsg || 'The agent encountered an error.'}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      {status === 'running' && (
        <div className="mt-4 flex justify-start">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Cancel and go back
          </button>
        </div>
      )}
    </div>
  );
}
