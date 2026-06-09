'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { parseDeckFromText } from '@/lib/parse-deck';
import { parseCardNamesInText } from '@/lib/card-linker';
import SaveDeckModal from './SaveDeckModal';
import { AgentCardsContainer } from './AgentSuggestionCard';
import type { AgentCard } from '@/lib/magic-agent/chat-integration';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  options?: string[];
  agentCards?: AgentCard[];
}

interface CopilotSidebarProps {
  collection?: {
    collectionSize: number;
    detectedFormat?: string;
    collectionCards: Array<{ name: string; quantity: number; priceUsd: number | null }>;
  };
  isOpen: boolean;
  onToggle: () => void;
  currentTab?: 'collection' | 'mydecks' | 'decks' | 'news' | 'chat' | 'venues';
  onCardClick?: (cardName: string) => void;
}

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  collection: [
    'What cards should I prioritize grading?',
    'Which sets am I closest to completing?',
    'Do I have any hidden gems?',
  ],
  mydecks: [
    'How can I improve my main deck?',
    'What cards should I add next?',
    'Is my deck legal in the current meta?',
  ],
  decks: [
    'Can I build this with my collection?',
    'What cards am I missing?',
    'What budget alternatives exist?',
  ],
  venues: [
    'Where can I find stores near me?',
    'What tournaments are upcoming?',
    'Where can I buy Magic cards?',
  ],
  news: [
    'How do these changes affect my decks?',
    'What new cards should I look for?',
    'Is there a buying opportunity?',
  ],
  chat: [
    'What can you help me with?',
    'Analyze my collection',
    'Find budget alternatives',
  ],
};

export function CopilotSidebar({ collection, isOpen, onToggle, currentTab = 'collection', onCardClick }: CopilotSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [pendingDeck, setPendingDeck] = useState<Record<string, number> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  const contextSuggestions = CONTEXT_SUGGESTIONS[currentTab] || CONTEXT_SUGGESTIONS.collection;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSaveDeck(name: string, format: string) {
    if (!pendingDeck) return;
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, format, cards: pendingDeck }),
    });
    if (!res.ok) throw new Error('Failed to save deck');
    setPendingDeck(null);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');
    setLoading(true);

    const userMsg: Message = { id: ++idRef.current, role: 'user', text: trimmed };
    const assistantId = ++idRef.current;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', text: '', streaming: true }]);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.text }));
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/collection-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: history,
          collectionSize: collection?.collectionSize || 0,
          detectedFormat: collection?.detectedFormat,
          allCards: (collection?.collectionCards || []).map((c) => ({
            name: c.name,
            qty: c.quantity,
            value: c.priceUsd,
          })),
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const event = JSON.parse(payload);
            if (event.type === 'text') {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + event.text } : m))
              );
            } else if (event.type === 'options') {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, options: event.options } : m))
              );
            } else if (event.type === 'agent-cards') {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, agentCards: event.cards } : m))
              );
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: 'Sorry, something went wrong. Try again.' } : m
          )
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      );
      setLoading(false);
    }
  }

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-screen bg-zinc-950 border-l border-zinc-800 flex flex-col transition-all duration-300 z-40 ${
          isOpen ? 'w-96' : 'w-0'
        }`}
      >
        {/* Header */}
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧙</span>
            <h2 className="text-sm font-semibold text-zinc-200">Shahrazad</h2>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-200"
            title="Close chat"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 p-3">
          {messages.length === 0 && (
            <div className="space-y-3 pt-4">
              <p className="text-xs text-zinc-500 text-center">Context questions:</p>
              <div className="flex flex-col gap-2">
                {contextSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    disabled={loading}
                    className="text-left text-xs px-2 py-1.5 rounded border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-400 hover:bg-zinc-900/50 transition-colors disabled:opacity-40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const deckSuggestion = msg.role === 'assistant' && !msg.streaming ? parseDeckFromText(msg.text) : null;
            const hasDeckButton = msg.role === 'assistant' && !msg.streaming && msg.text.includes('**➕ Add Deck**');

            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[85%] space-y-1">
                  <div
                    className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-amber-400 text-black rounded-br-sm'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p>{msg.text}</p>
                    ) : (
                      <div className="chat-markdown space-y-2">
                        {msg.text.split('\n\n').map((paragraph, idx) => (
                          <div key={idx}>
                            {parseCardNamesInText(paragraph).map((part, pidx) =>
                              part.isCard && part.cardName ? (
                                <button
                                  key={pidx}
                                  type="button"
                                  onClick={() => onCardClick?.(part.cardName!)}
                                  className="text-amber-400 hover:underline cursor-pointer inline"
                                >
                                  {part.text}
                                </button>
                              ) : (
                                <span key={pidx}>{part.text}</span>
                              )
                            )}
                          </div>
                        ))}
                        {msg.streaming && msg.text && <span className="animate-pulse">▌</span>}
                      </div>
                    )}
                  </div>

                  {/* Add to Decks button */}
                  {(deckSuggestion || hasDeckButton) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (deckSuggestion) {
                          setPendingDeck(deckSuggestion.cards);
                          setShowDeckModal(true);
                        }
                      }}
                      className="px-2 py-1 text-xs rounded bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors"
                    >
                      ➕ Add Deck
                    </button>
                  )}

                  {/* Agent cards */}
                  {msg.role === 'assistant' && msg.agentCards && msg.agentCards.length > 0 && (
                    <AgentCardsContainer cards={msg.agentCards} />
                  )}

                  {/* Follow-up buttons */}
                  {msg.role === 'assistant' && !msg.streaming && msg.options && msg.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {msg.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => send(opt)}
                          disabled={loading}
                          className="px-2 py-1 text-xs rounded border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors disabled:opacity-40"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 p-3 flex gap-1.5 flex-shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask Shahrazad…"
            disabled={loading}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
          {loading ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="px-2 py-1.5 rounded text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {/* Toggle button (visible when closed) */}
      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          className="fixed right-4 bottom-4 w-12 h-12 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-bold shadow-lg transition-all hover:scale-110 z-30 flex items-center justify-center text-lg"
          title="Open Shahrazad"
        >
          🧙
        </button>
      )}

      {/* Save Deck Modal */}
      <SaveDeckModal
        isOpen={showDeckModal}
        cards={pendingDeck || {}}
        onSave={handleSaveDeck}
        onClose={() => {
          setShowDeckModal(false);
          setPendingDeck(null);
        }}
      />
    </>
  );
}
