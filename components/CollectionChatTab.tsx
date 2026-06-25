'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { CollectionResult } from '@/app/(collector)/page';
import type { AgentCard } from '@/lib/magic-agent/chat-integration';
import { parseDeckFromText } from '@/lib/parse-deck';
import { findCombos } from '@/lib/combo-finder';
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

interface ChatSummary {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string;
}

function titleFromMessage(text: string): string {
  return text.length > 48 ? text.slice(0, 45) + '…' : text;
}

const SUGGESTIONS = [
  'What decks can I build with my collection?',
  'What are my most valuable cards?',
  'Which sets am I closest to completing?',
  'Find combos in my collection',
  'How many paper cards vs Arena cards do I have?',
];

export default function CollectionChatTab({
  collection,
  prefillMessage = '',
  onMessageSent,
}: {
  collection: CollectionResult;
  prefillMessage?: string;
  onMessageSent?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [pendingDeck, setPendingDeck] = useState<Record<string, number> | null>(null);
  const [pendingList, setPendingList] = useState<Record<string, number> | null>(null);
  const [conversations, setConversations] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [proactiveCards, setProactiveCards] = useState<string[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Close history panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Detect combos in collection
  useEffect(() => {
    const names = collection.collectionCards.map(c => c.name);
    const found = findCombos(names);
    if (found.length > 0) {
      setProactiveCards(found.map(c => `**${c.cards.join(' + ')}** — ${c.description} (${c.result})`));
    }
  }, [collection]);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/khoa-chats');
    if (res.ok) {
      const data = await res.json() as ChatSummary[];
      setConversations(data);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (prefillMessage && !input) setInput(prefillMessage);
  }, [prefillMessage, input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save after each completed response
  const autoSave = useCallback(async (msgs: Message[], chatId: string, title: string) => {
    const payload = msgs.filter(m => !m.streaming).map(m => ({ id: m.id, role: m.role, text: m.text }));
    if (payload.length < 2) return;
    await fetch('/api/khoa-chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: chatId, title, messages: payload }),
    });
    loadConversations();
  }, [loadConversations]);

  function startNewChat() {
    setMessages([]);
    setActiveChatId(null);
    setShowHistory(false);
    setInput('');
  }

  async function loadChat(id: string) {
    const res = await fetch(`/api/khoa-chats/${id}`);
    if (!res.ok) return;
    const data = await res.json() as { messages: Message[]; title: string };
    setMessages(data.messages.map((m, i) => ({ ...m, id: i })));
    idRef.current = data.messages.length;
    setActiveChatId(id);
    setShowHistory(false);
  }

  async function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/khoa-chats/${id}`, { method: 'DELETE' });
    if (activeChatId === id) startNewChat();
    loadConversations();
  }

  async function togglePin(chat: ChatSummary, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/khoa-chats/${chat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !chat.pinned }),
    });
    loadConversations();
  }

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

    const chatId = activeChatId ?? generateId();
    if (!activeChatId) setActiveChatId(chatId);
    const title = titleFromMessage(trimmed);

    const userMsg: Message = { id: ++idRef.current, role: 'user', text: trimmed };
    const assistantId = ++idRef.current;
    const nextMessages = [...messages, userMsg, { id: assistantId, role: 'assistant' as const, text: '', streaming: true }];
    setMessages(nextMessages);

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.text }));
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let finalText = '';

    try {
      const res = await fetch('/api/collection-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: history,
          collectionSize: collection.collectionSize,
          detectedFormat: collection.detectedFormat,
          allCards: collection.collectionCards.map(c => ({
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
              finalText += event.text;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: m.text + event.text } : m));
            } else if (event.type === 'options') {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, options: event.options } : m));
            } else if (event.type === 'agent-cards') {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, agentCards: event.cards } : m));
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: 'Sorry, something went wrong. Try again.' } : m));
      }
    } finally {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
      setLoading(false);
      onMessageSent?.();

      // Auto-save after response completes
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setMessages(current => {
          autoSave(current, chatId, title);
          return current;
        });
      }, 500);
    }
  }

  const pinnedChats = conversations.filter(c => c.pinned);
  const recentChats = conversations.filter(c => !c.pinned);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">

      {/* Top bar: conversation picker + new chat */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1" ref={historyRef}>
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors w-full text-left"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span className="truncate">{activeChatId ? (conversations.find(c => c.id === activeChatId)?.title ?? 'Current chat') : 'New conversation'}</span>
            <svg className="w-3 h-3 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>

          {showHistory && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-20 max-h-72 overflow-y-auto">
              {pinnedChats.length === 0 && recentChats.length === 0 && (
                <p className="px-4 py-3 text-xs text-zinc-600">No saved conversations yet</p>
              )}
              {pinnedChats.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-xs text-zinc-600 uppercase tracking-wide">Pinned</p>
                  {pinnedChats.map(c => <ChatRow key={c.id} chat={c} active={c.id === activeChatId} onSelect={() => loadChat(c.id)} onPin={(e) => togglePin(c, e)} onDelete={(e) => deleteChat(c.id, e)} />)}
                </div>
              )}
              {recentChats.length > 0 && (
                <div>
                  {pinnedChats.length > 0 && <div className="border-t border-zinc-800 my-1" />}
                  <p className="px-3 pt-2 pb-1 text-xs text-zinc-600 uppercase tracking-wide">Recent</p>
                  {recentChats.map(c => <ChatRow key={c.id} chat={c} active={c.id === activeChatId} onSelect={() => loadChat(c.id)} onPin={(e) => togglePin(c, e)} onDelete={(e) => deleteChat(c.id, e)} />)}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={startNewChat}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors shrink-0"
          title="New chat"
        >
          + New
        </button>
      </div>

      {/* Context badge */}
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800">
          {collection.collectionSize.toLocaleString()} cards
          {collection.detectedFormat && collection.detectedFormat !== 'Unknown' ? ` · ${collection.detectedFormat}` : ''}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-3">
        {messages.length === 0 && (
          <div className="py-2 space-y-4">
            {/* Combo proactive suggestions */}
            {proactiveCards.length > 0 && (
              <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-amber-400">⚡ Combos found in your collection</p>
                <ul className="space-y-1">
                  {proactiveCards.map((c, i) => (
                    <li key={i} className="text-xs text-zinc-300">
                      <ReactMarkdown>{c}</ReactMarkdown>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => send('Tell me more about the combos in my collection and how to use them')}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Ask Khoa about these →
                </button>
              </div>
            )}

            <p className="text-center text-zinc-600 text-xs">Ask anything about your collection</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left text-xs px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          if (msg.role === 'user' && idx === messages.length - 1) return null;
          const deckSuggestion = msg.role === 'assistant' && !msg.streaming ? parseDeckFromText(msg.text) : null;

          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] space-y-1.5">
                <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-amber-400 text-black rounded-br-sm' : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm'}`}>
                  {msg.role === 'user' ? (
                    <p>{msg.text}</p>
                  ) : (
                    <div className="chat-markdown">
                      <ReactMarkdown>{msg.text || (msg.streaming ? '▌' : '')}</ReactMarkdown>
                      {msg.streaming && msg.text && <span className="animate-pulse">▌</span>}
                    </div>
                  )}
                </div>

                {deckSuggestion && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setPendingDeck(deckSuggestion.cards); setShowDeckModal(true); }} className="px-3 py-1.5 text-xs rounded-lg bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors">
                      ➕ Save as Deck
                    </button>
                    <button type="button" onClick={() => { setPendingList(deckSuggestion.cards); setShowListModal(true); }} className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-amber-400 font-semibold hover:bg-zinc-700 border border-zinc-700 transition-colors">
                      📋 Save as List
                    </button>
                  </div>
                )}

                {msg.role === 'assistant' && msg.agentCards && msg.agentCards.length > 0 && (
                  <AgentCardsContainer cards={msg.agentCards} />
                )}

                {msg.role === 'assistant' && !msg.streaming && msg.options && msg.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {msg.options.map(opt => (
                      <button key={opt} type="button" onClick={() => send(opt)} disabled={loading} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors disabled:opacity-40">
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Sticky latest user message */}
        {messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-xl px-3 py-2 text-sm bg-amber-400 text-black rounded-br-sm">
              {messages[messages.length - 1].text}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-1.5 pt-2.5 border-t border-zinc-800">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask about your collection…"
          disabled={loading}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        {loading ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className="px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200">
            Stop
          </button>
        ) : (
          <button type="button" onClick={() => send(input)} disabled={!input.trim()} className="px-3 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 transition-colors">
            Send
          </button>
        )}
      </div>

      <SaveDeckModal isOpen={showDeckModal} cards={pendingDeck || {}} onSave={handleSaveDeck} onClose={() => { setShowDeckModal(false); setPendingDeck(null); }} />
      {showListModal && <SaveListModal cards={pendingList || {}} onSave={handleSaveList} onCancel={() => { setShowListModal(false); setPendingList(null); }} />}
    </div>
  );
}

function ChatRow({ chat, active, onSelect, onPin, onDelete }: { chat: ChatSummary; active: boolean; onSelect: () => void; onPin: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800 transition-colors ${active ? 'bg-zinc-800' : ''}`}
    >
      <span className="flex-1 text-xs text-zinc-300 truncate">{chat.title}</span>
      <button type="button" onClick={onPin} className={`shrink-0 text-xs transition-colors ${chat.pinned ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100'}`} title={chat.pinned ? 'Unpin' : 'Pin'}>
        ★
      </button>
      <button type="button" onClick={onDelete} className="shrink-0 text-xs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Delete">
        ✕
      </button>
    </div>
  );
}
