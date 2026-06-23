'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];

interface InventoryItem {
  id: string;
  cardName: string;
  setCode: string;
  collectorNumber: string | null;
  condition: string;
  foil: boolean;
  language: string;
  quantity: number;
  priceCents: number;
  imageUrl: string | null;
  scryfallId: string;
  notes: string | null;
  createdAt: string;
}

interface ReviewCard {
  found: boolean;
  qty: number;
  name: string;
  scryfallId?: string;
  cardName?: string;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUrl?: string | null;
  marketPriceCents?: number | null;
  priceCents: number;
  condition: string;
  foil: boolean;
  include: boolean;
}

interface InlineEdit {
  quantity: number;
  priceCents: number;
  condition: string;
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function ShopHeader({ shopName }: { shopName: string }) {
  return (
    <header className="border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/shop/dashboard" className="text-xl font-black">
            <span className="text-amber-400">Grimoire</span>
          </Link>
          <span className="text-zinc-600 text-sm hidden sm:block">/ {shopName} / Inventory</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/shop/dashboard" className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">Dashboard</Link>
          <Link href="/shop/orders" className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">Orders</Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="px-3 py-1.5 text-sm text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors">Sign out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}

export default function InventoryPage() {
  const [shopName, setShopName] = useState('My Shop');

  // Inventory list
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [listLoading, setListLoading] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<InlineEdit>({ quantity: 1, priceCents: 0, condition: 'NM' });
  const [saving, setSaving] = useState(false);

  // Add cards panel
  const [activeTab, setActiveTab] = useState<'search' | 'paste' | 'upload'>('paste');

  // Search tab
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [stagingCards, setStagingCards] = useState<ReviewCard[]>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paste / upload review
  const [pasteText, setPasteText] = useState('');
  const [parseLoading, setParseLoading] = useState(false);
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [notFoundCount, setNotFoundCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add to inventory
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  // ─── Load shop name ───────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/shops/me')
      .then(r => r.json())
      .then(d => { if (d?.shop?.name) setShopName(d.shop.name); })
      .catch(() => {});
  }, []);

  // ─── Load inventory ───────────────────────────────────────────────
  const loadInventory = useCallback(async () => {
    setListLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (search) qs.set('search', search);
      if (conditionFilter) qs.set('condition', conditionFilter);
      const res = await fetch(`/api/shops/inventory?${qs}`);
      const data = await res.json() as { items: InventoryItem[]; total: number; page: number; pages: number };
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {
      // ignore
    } finally {
      setListLoading(false);
    }
  }, [page, search, conditionFilter]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  // ─── Search debounce ──────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchQuery || searchQuery.length < 2) { setSuggestions([]); return; }
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(searchQuery)}&include_extras=false`);
        const data = await res.json() as { data: string[] };
        setSuggestions(data.data?.slice(0, 8) ?? []);
        setSuggestOpen(true);
      } catch { /* ignore */ }
    }, 280);
  }, [searchQuery]);

  // ─── Add single card from search ─────────────────────────────────
  async function addFromSearch(name: string) {
    setSuggestOpen(false);
    setSearchQuery(name);
    try {
      const res = await fetch('/api/shops/parse-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `1 ${name}` }),
      });
      const data = await res.json() as { results: ReviewCard[] };
      if (data.results?.[0]) {
        setStagingCards(prev => [...prev, { ...data.results[0], include: true }]);
      }
    } catch { /* ignore */ }
    setSearchQuery('');
    setSuggestions([]);
  }

  // ─── Parse paste/upload text ──────────────────────────────────────
  async function parseText(text: string) {
    if (!text.trim()) return;
    setParseLoading(true);
    setReviewCards([]);
    setNotFoundCount(0);
    setAddResult(null);
    try {
      const res = await fetch('/api/shops/parse-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as { results: ReviewCard[]; notFoundCount: number };
      setReviewCards((data.results ?? []).map(r => ({ ...r, include: r.found })));
      setNotFoundCount(data.notFoundCount ?? 0);
    } catch { /* ignore */ } finally {
      setParseLoading(false);
    }
  }

  // ─── File upload ──────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setActiveTab('upload');
      parseText(text);
    };
    reader.readAsText(file);
  }

  // ─── Confirm add (staging or review) ────────────────────────────
  async function confirmAdd(cards: ReviewCard[], onSuccess: () => void) {
    const toAdd = cards.filter(c => c.include && c.found && c.scryfallId);
    if (!toAdd.length) return;
    setAdding(true);
    setAddResult(null);
    try {
      const res = await fetch('/api/shops/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: toAdd.map(c => ({
            scryfallId: c.scryfallId!,
            cardName: c.cardName ?? c.name,
            setCode: c.setCode ?? '',
            collectorNumber: c.collectorNumber,
            condition: c.condition,
            foil: c.foil,
            quantity: c.qty,
            priceCents: c.priceCents,
            imageUrl: c.imageUrl,
          })),
        }),
      });
      const data = await res.json() as { added: number };
      setAddResult(`Added ${data.added} card${data.added !== 1 ? 's' : ''} to inventory`);
      onSuccess();
      loadInventory();
    } catch { /* ignore */ } finally {
      setAdding(false);
    }
  }

  // ─── Inline edit helpers ──────────────────────────────────────────
  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setEditValues({ quantity: item.quantity, priceCents: item.priceCents, condition: item.condition });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/shops/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editValues),
      });
      setEditingId(null);
      loadInventory();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove this card from inventory?')) return;
    await fetch(`/api/shops/inventory/${id}`, { method: 'DELETE' });
    loadInventory();
  }

  function updateReview(i: number, patch: Partial<ReviewCard>, list: ReviewCard[], setter: (v: ReviewCard[]) => void) {
    const next = [...list];
    next[i] = { ...next[i], ...patch };
    setter(next);
  }

  const includedStaging = stagingCards.filter(c => c.include && c.found).length;
  const includedReview = reviewCards.filter(c => c.include && c.found).length;
  const currentIncluded = activeTab === 'search' ? includedStaging : includedReview;

  return (
    <main className={`min-h-screen bg-zinc-950 text-zinc-100${currentIncluded > 0 ? ' pb-24' : ''}`}>
      <ShopHeader shopName={shopName} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inventory</h1>
            <p className="text-zinc-500 text-sm mt-0.5">{total.toLocaleString()} cards in stock</p>
          </div>
        </div>

        {/* ─── ADD CARDS PANEL ──────────────────────────────────────────── */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="border-b border-zinc-800 px-5 py-3 flex items-center gap-1">
            {(['paste', 'search', 'upload'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setAddResult(null); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-amber-400 text-black'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {tab === 'paste' ? 'Paste List' : tab === 'search' ? 'Search' : 'Upload File'}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            {/* ── SEARCH TAB ─────────────────────────────────────── */}
            {activeTab === 'search' && (
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type a card name…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                  {suggestOpen && suggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
                      {suggestions.map(s => (
                        <li key={s}>
                          <button
                            onClick={() => addFromSearch(s)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors"
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {stagingCards.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-end gap-3 text-sm text-zinc-500">
                      <button
                        type="button"
                        onClick={() => setStagingCards(prev => prev.map(c => ({ ...c, include: c.found })))}
                        className="hover:text-zinc-200 transition-colors"
                      >
                        Select all
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setStagingCards(prev => prev.map(c => ({ ...c, include: false })))}
                        className="hover:text-zinc-200 transition-colors"
                      >
                        None
                      </button>
                    </div>
                    <ReviewTable
                      cards={stagingCards}
                      onChange={(i, patch) => updateReview(i, patch, stagingCards, setStagingCards)}
                      onRemove={i => setStagingCards(prev => prev.filter((_, idx) => idx !== i))}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── PASTE TAB ──────────────────────────────────────── */}
            {activeTab === 'paste' && (
              <div className="space-y-4">
                <textarea
                  rows={8}
                  placeholder={"Paste your card list here (MTGA/Moxfield format):\n1 Sol Ring (C21) 263\n1 Command Tower (ELD) 333\n4 Lightning Bolt (2X2) 117"}
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setReviewCards([]); setAddResult(null); }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-amber-500 resize-y"
                />
                <button
                  disabled={parseLoading || !pasteText.trim()}
                  onClick={() => parseText(pasteText)}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                >
                  {parseLoading ? 'Looking up cards…' : 'Preview Cards'}
                </button>
              </div>
            )}

            {/* ── UPLOAD TAB ─────────────────────────────────────── */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl p-10 text-center cursor-pointer transition-colors group"
                >
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    Click to upload a text file
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">MTGA export, Moxfield list, or plain text</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.text,.rtf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                {parseLoading && (
                  <p className="text-sm text-zinc-400 text-center animate-pulse">Looking up cards…</p>
                )}
              </div>
            )}

            {/* ── REVIEW TABLE (paste + upload share this) ────────── */}
            {(activeTab === 'paste' || activeTab === 'upload') && reviewCards.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">
                    {reviewCards.filter(c => c.found).length} found
                    {notFoundCount > 0 && (
                      <span className="text-amber-400/80 ml-2">· {notFoundCount} not found</span>
                    )}
                  </span>
                  <div className="flex items-center gap-3 text-zinc-500">
                    <button
                      type="button"
                      onClick={() => setReviewCards(prev => prev.map(c => ({ ...c, include: c.found })))}
                      className="hover:text-zinc-200 transition-colors"
                    >
                      Select all
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setReviewCards(prev => prev.map(c => ({ ...c, include: false })))}
                      className="hover:text-zinc-200 transition-colors"
                    >
                      None
                    </button>
                  </div>
                </div>
                <ReviewTable
                  cards={reviewCards}
                  onChange={(i, patch) => updateReview(i, patch, reviewCards, setReviewCards)}
                  onRemove={i => setReviewCards(prev => prev.filter((_, idx) => idx !== i))}
                />
              </div>
            )}

          </div>
        </section>

        {/* ─── INVENTORY TABLE ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by card name…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
            <select
              value={conditionFilter}
              onChange={e => { setConditionFilter(e.target.value); setPage(1); }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">All Conditions</option>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {listLoading ? (
            <div className="py-12 text-center text-zinc-500 text-sm animate-pulse">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 text-sm">
              {search || conditionFilter ? 'No cards match that filter.' : 'No cards in inventory yet. Add some above.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Card</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Set</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cond</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Foil</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Qty</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Price</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {items.map(item => {
                    const isEditing = editingId === item.id;
                    return (
                      <tr key={item.id} className={`hover:bg-zinc-900/40 transition-colors ${isEditing ? 'bg-zinc-900/60' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.cardName}
                                className="w-8 h-11 object-cover rounded"
                                loading="lazy"
                              />
                            )}
                            <span className="font-medium">{item.cardName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 uppercase text-xs">{item.setCode}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editValues.condition}
                              onChange={e => setEditValues(v => ({ ...v, condition: e.target.value }))}
                              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
                            >
                              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{item.condition}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {item.foil ? <span className="text-amber-400 text-xs">Foil</span> : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0}
                              value={editValues.quantity}
                              onChange={e => setEditValues(v => ({ ...v, quantity: parseInt(e.target.value, 10) || 0 }))}
                              className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-right"
                            />
                          ) : item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-zinc-500">$</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={(editValues.priceCents / 100).toFixed(2)}
                                onChange={e => setEditValues(v => ({ ...v, priceCents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                                className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-right"
                              />
                            </div>
                          ) : fmt(item.priceCents)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  disabled={saving}
                                  onClick={() => saveEdit(item.id)}
                                  className="px-2 py-1 text-xs rounded bg-amber-400 text-black font-semibold hover:bg-amber-300 disabled:opacity-50 transition-colors"
                                >
                                  {saving ? '…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-2 py-1 text-xs rounded bg-zinc-700 hover:bg-zinc-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(item)}
                                  className="px-2 py-1 text-xs rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteItem(item.id)}
                                  className="px-2 py-1 text-xs rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-40 hover:bg-zinc-800 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-zinc-500">{page} / {pages}</span>
              <button
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-40 hover:bg-zinc-800 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </div>
      {/* ─── Sticky confirm bar ─────────────────────────────────────── */}
      {currentIncluded > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium text-zinc-300 shrink-0">
                {currentIncluded} card{currentIncluded !== 1 ? 's' : ''} selected
              </span>
              {addResult && (
                <span className="text-sm text-green-400 truncate">{addResult}</span>
              )}
            </div>
            <button
              type="button"
              disabled={adding}
              onClick={() => {
                if (activeTab === 'search') {
                  confirmAdd(stagingCards, () => setStagingCards([]));
                } else {
                  confirmAdd(reviewCards, () => { setReviewCards([]); setPasteText(''); });
                }
              }}
              className="px-6 py-2 rounded-xl text-sm font-bold bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-50 transition-colors shrink-0"
            >
              {adding ? 'Adding…' : `Add ${currentIncluded} to Inventory`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Shared review table ──────────────────────────────────────────────────────

function ReviewTable({
  cards,
  onChange,
  onRemove,
}: {
  cards: ReviewCard[];
  onChange: (i: number, patch: Partial<ReviewCard>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            <th className="px-3 py-2.5 text-center text-zinc-400 font-medium w-8">✓</th>
            <th className="text-left px-3 py-2.5 text-zinc-400 font-medium">Card</th>
            <th className="text-left px-3 py-2.5 text-zinc-400 font-medium">Set</th>
            <th className="text-center px-3 py-2.5 text-zinc-400 font-medium">Qty</th>
            <th className="text-left px-3 py-2.5 text-zinc-400 font-medium">Cond</th>
            <th className="text-center px-3 py-2.5 text-zinc-400 font-medium">Foil</th>
            <th className="text-right px-3 py-2.5 text-zinc-400 font-medium">Price</th>
            <th className="px-3 py-2.5 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {cards.map((card, i) => (
            <tr key={i} className={`${!card.found ? 'opacity-50' : ''} hover:bg-zinc-900/30 transition-colors`}>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={card.include && card.found}
                  disabled={!card.found}
                  onChange={e => onChange(i, { include: e.target.checked })}
                  className="accent-amber-400 w-4 h-4"
                />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {card.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.imageUrl} alt={card.name} className="w-7 h-10 object-cover rounded" loading="lazy" />
                  )}
                  <div>
                    <div className="font-medium leading-tight">{card.cardName ?? card.name}</div>
                    {!card.found && <div className="text-xs text-red-400">Not found</div>}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-zinc-400 text-xs uppercase">{card.setCode ?? '—'}</td>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="number"
                  min={1}
                  value={card.qty}
                  onChange={e => onChange(i, { qty: parseInt(e.target.value, 10) || 1 })}
                  className="w-14 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-center"
                />
              </td>
              <td className="px-3 py-2.5">
                <select
                  value={card.condition}
                  onChange={e => onChange(i, { condition: e.target.value })}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs"
                >
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </td>
              <td className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={card.foil}
                  onChange={e => onChange(i, { foil: e.target.checked })}
                  className="accent-amber-400 w-4 h-4"
                />
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex items-center justify-end gap-0.5">
                  <span className="text-zinc-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={(card.priceCents / 100).toFixed(2)}
                    onChange={e => onChange(i, { priceCents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-right"
                  />
                </div>
                {card.marketPriceCents != null && (
                  <div className="text-xs text-zinc-600 text-right">mkt {fmt(card.marketPriceCents)}</div>
                )}
              </td>
              <td className="px-3 py-2.5">
                <button
                  onClick={() => onRemove(i)}
                  className="text-zinc-600 hover:text-red-400 transition-colors text-xs"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
