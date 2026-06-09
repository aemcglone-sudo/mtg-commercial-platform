'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { CollectionResult } from '@/app/page';
import type { AgentCard } from '@/lib/magic-agent/chat-integration';
import { parseDeckFromText } from '@/lib/parse-deck';
import SaveDeckModal from './SaveDeckModal';
import SaveListModal from './SaveListModal';
import { AgentCardsContainer } from './AgentSuggestionCard';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  options?: string[];
  agentCards?: AgentCard[];
}

const SUGGESTIONS = [
  'How many paper cards and how many Arena cards do I have?',
  'What are my most valuable cards?',
  'Which sets am I closest to completing?',
  'What should I prioritize grading?',
];

export default function CollectionChatTab({ collection, prefillMessage = '', onMessageSent }: { collection: CollectionResult; prefillMessage?: string; onMessageSent?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [pendingDeck, setPendingDeck] = useState<Record<string, number> | null>(null);
  const [pendingList, setPendingList] = useState<Record<string, number> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (prefillMessage && !input) {
      setInput(prefillMessage);
    }
  }, [prefillMessage, input]);

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
    setShowDeckModal(false);
  }

  async function handleSaveList(name: string) {
    if (!pendingList) return;
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, format: 'List', cards: pendingList, isList: true }),
    });
    if (!res.ok) throw new Error('Failed to save list');
    setPendingList(null);
    setShowListModal(false);
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
          collectionSize: collection.collectionSize,
          detectedFormat: collection.detectedFormat,
          // Send full collection so Claude can give accurate pull lists
          allCards: collection.collectionCards.map((c) => ({
            name: c.name,
            qty: c.quantity,
            value: c.priceUsd,
            collectionType: c.collectionType,
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
      onMessageSent?.();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)]">
        {/* Context badge */}
        <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800">
          Chatting with {collection.collectionSize.toLocaleString()} cards
          {collection.detectedFormat && collection.detectedFormat !== 'Unknown'
            ? ` · ${collection.detectedFormat}`
            : ''}
        </span>
      </div>

      {/* Last user question - sticky at top */}
      {messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
        <div className="sticky top-0 bg-zinc-950 pb-2 border-b border-zinc-800">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-xl px-3 py-2 text-sm bg-amber-400 text-black rounded-br-sm">
              {messages[messages.length - 1].text}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-3 pt-2">
        {messages.length === 0 && (
          <div className="py-2 space-y-2">
            <p className="text-center text-zinc-600 text-xs">Ask anything about your collection</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left text-xs px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          // Skip the last user message since it's displayed sticky at top
          if (msg.role === 'user' && idx === messages.length - 1) return null;
          const deckSuggestion = msg.role === 'assistant' && !msg.streaming ? parseDeckFromText(msg.text) : null;

          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[80%] space-y-1.5">
                <div
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-amber-400 text-black rounded-br-sm'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p>{msg.text}</p>
                  ) : (
                    <div className="chat-markdown">
                      <ReactMarkdown>{msg.text || (msg.streaming ? '▌' : '')}</ReactMarkdown>
                      {msg.streaming && msg.text && <span className="animate-pulse">▌</span>}
                    </div>
                  )}
                </div>

                {/* Save Buttons */}
                {deckSuggestion && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDeck(deckSuggestion.cards);
                        setShowDeckModal(true);
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors"
                    >
                      ➕ Save as Deck
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingList(deckSuggestion.cards);
                        setShowListModal(true);
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-amber-400 font-semibold hover:bg-zinc-700 border border-zinc-700 transition-colors"
                    >
                      📋 Save as List
                    </button>
                  </div>
                )}

                {/* Agent suggestion cards */}
                {msg.role === 'assistant' && msg.agentCards && msg.agentCards.length > 0 && (
                  <AgentCardsContainer cards={msg.agentCards} />
                )}

                {/* Follow-up option buttons */}
                {msg.role === 'assistant' && !msg.streaming && msg.options && msg.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {msg.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => send(opt)}
                        disabled={loading}
                        className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors disabled:opacity-40"
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
      <div className="flex gap-1.5 pt-2.5 border-t border-zinc-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask about your collection…"
          disabled={loading}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        {loading ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        )}
      </div>

      <SaveDeckModal
        isOpen={showDeckModal}
        cards={pendingDeck || {}}
        onSave={handleSaveDeck}
        onClose={() => {
          setShowDeckModal(false);
          setPendingDeck(null);
        }}
      />

      {showListModal && (
        <SaveListModal
          cards={pendingList || {}}
          onSave={handleSaveList}
          onCancel={() => {
            setShowListModal(false);
            setPendingList(null);
          }}
        />
      )}
    </div>
  );
}
