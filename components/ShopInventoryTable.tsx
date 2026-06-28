'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CardNameLink } from '@/components/CardNameLink';

export interface ShopInventoryItem {
  id: string;
  cardName: string;
  setCode: string;
  condition: string;
  foil: boolean;
  quantity: number;
  priceCents: number;
  imageUrl: string | null;
  scryfallId: string;
  typeLine: string | null;
  colors: string | null;
  cmc: number | null;
  rarity: string | null;
}

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
const COLOR_MAP: Record<string, { bg: string; label: string }> = {
  W: { bg: 'bg-yellow-100', label: 'W' },
  U: { bg: 'bg-blue-500', label: 'U' },
  B: { bg: 'bg-zinc-700', label: 'B' },
  R: { bg: 'bg-red-500', label: 'R' },
  G: { bg: 'bg-green-600', label: 'G' },
};
const RARITY_COLOR: Record<string, string> = {
  common: 'text-zinc-400',
  uncommon: 'text-slate-300',
  rare: 'text-amber-400',
  mythic: 'text-orange-400',
};

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function parseColors(raw: string | null): string[] {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

interface BulkRepriceState {
  mode: 'flat' | 'pct';
  value: string;
  open: boolean;
}

interface Props {
  onStatsChange?: (unique: number, total: number, value: number) => void;
}

export default function ShopInventoryTable({ onStatsChange }: Props) {
  const [items, setItems] = useState<ShopInventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMarketCol, setShowMarketCol] = useState(false);
  const [marketPrices, setMarketPrices] = useState<Record<string, { usd: number | null }>>({});
  const [marketLoading, setMarketLoading] = useState(false);
  const [bulkReprice, setBulkReprice] = useState<BulkRepriceState>({ mode: 'flat', value: '', open: false });
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  const onStatsChangeRef = useRef(onStatsChange);
  useEffect(() => { onStatsChangeRef.current = onStatsChange; });

  const load = useCallback(async (p = 1, q = search, cond = conditionFilter) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), limit: '50' });
      if (q) qs.set('search', q);
      if (cond) qs.set('condition', cond);
      const res = await fetch(`/api/shops/inventory?${qs}`);
      if (!res.ok) return;
      const data = await res.json() as { items: ShopInventoryItem[]; total: number; pages: number };
      setItems(data.items);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
      setSelected(new Set());
      onStatsChangeRef.current?.(
        data.items.length,
        data.items.reduce((s, i) => s + i.quantity, 0),
        data.items.reduce((s, i) => s + i.priceCents * i.quantity, 0)
      );
    } finally {
      setLoading(false);
    }
  }, [search, conditionFilter]); // onStatsChange intentionally via ref — stable callback

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      load(1);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(1, search, conditionFilter), 280);
  }, [search, conditionFilter, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch market prices when column toggled on or page changes
  useEffect(() => {
    if (!showMarketCol || items.length === 0) return;
    const ids = [...new Set(items.map(i => i.scryfallId))];
    setMarketLoading(true);
    fetch('/api/shops/inventory/market-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scryfallIds: ids }),
    })
      .then(r => r.json())
      .then(data => setMarketPrices(prev => ({ ...prev, ...data })))
      .finally(() => setMarketLoading(false));
  }, [showMarketCol, items]);

  async function patchItem(id: string, patch: Record<string, number | string | boolean>) {
    setSaving(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/shops/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove this card from inventory?')) return;
    await fetch(`/api/shops/inventory/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
    setTotal(prev => prev - 1);
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  async function deleteSelected() {
    if (!confirm(`Remove ${selected.size} card${selected.size !== 1 ? 's' : ''} from inventory?`)) return;
    const ids = [...selected];
    await Promise.all(ids.map(id => fetch(`/api/shops/inventory/${id}`, { method: 'DELETE' })));
    setItems(prev => prev.filter(i => !ids.includes(i.id)));
    setTotal(prev => prev - ids.length);
    setSelected(new Set());
  }

  async function repriceSelected() {
    const { mode, value } = bulkReprice;
    if (!value.trim()) return;
    const ids = [...selected];
    const toUpdate: Array<{ id: string; priceCents: number }> = [];

    for (const id of ids) {
      const item = items.find(i => i.id === id);
      if (!item) continue;
      let newCents: number;
      if (mode === 'flat') {
        newCents = Math.round(parseFloat(value) * 100);
      } else {
        const pct = parseFloat(value.replace('%', '').replace('+', ''));
        newCents = Math.round(item.priceCents * (1 + pct / 100));
      }
      if (!isNaN(newCents) && newCents > 0) toUpdate.push({ id, priceCents: newCents });
    }

    await Promise.all(toUpdate.map(({ id, priceCents }) =>
      fetch(`/api/shops/inventory/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceCents }),
      })
    ));
    setItems(prev => prev.map(item => {
      const u = toUpdate.find(t => t.id === item.id);
      return u ? { ...item, priceCents: u.priceCents } : item;
    }));
    setBulkReprice(p => ({ ...p, open: false, value: '' }));
  }

  async function repriceToMarket() {
    const ids = [...selected];
    const toUpdate: Array<{ id: string; priceCents: number }> = [];
    const missingIds = ids.map(id => items.find(i => i.id === id)?.scryfallId).filter((id): id is string => !!id && !(id in marketPrices));

    if (missingIds.length > 0) {
      const res = await fetch('/api/shops/inventory/market-prices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scryfallIds: missingIds }),
      });
      const extra = await res.json() as Record<string, { usd: number | null }>;
      setMarketPrices(prev => ({ ...prev, ...extra }));
      Object.assign(marketPrices, extra);
    }

    for (const id of ids) {
      const item = items.find(i => i.id === id);
      if (!item) continue;
      const market = marketPrices[item.scryfallId];
      if (market?.usd != null) toUpdate.push({ id, priceCents: market.usd });
    }

    await Promise.all(toUpdate.map(({ id, priceCents }) =>
      fetch(`/api/shops/inventory/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceCents }),
      })
    ));
    setItems(prev => prev.map(item => {
      const u = toUpdate.find(t => t.id === item.id);
      return u ? { ...item, priceCents: u.priceCents } : item;
    }));
  }

  function exportCSV() {
    const rows = (selected.size > 0 ? items.filter(i => selected.has(i.id)) : items);
    const header = 'Card,Set,Condition,Foil,Qty,Price';
    const body = rows.map(r => `"${r.cardName}",${r.setCode},${r.condition},${r.foil},${r.quantity},${(r.priceCents / 100).toFixed(2)}`).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'inventory.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  }

  function vsMarket(item: ShopInventoryItem): React.ReactNode {
    const market = marketPrices[item.scryfallId];
    if (!market || market.usd == null) return <span className="text-zinc-600">—</span>;
    const delta = ((item.priceCents - market.usd) / market.usd) * 100;
    if (Math.abs(delta) < 5) return <span className="text-zinc-500">~</span>;
    return delta > 0
      ? <span className="text-green-400">+{delta.toFixed(0)}%</span>
      : <span className="text-red-400">{delta.toFixed(0)}%</span>;
  }

  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text" placeholder="Search cards…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-36 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
        />
        <select title="Condition filter" value={conditionFilter} onChange={e => setConditionFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500">
          <option value="">All conditions</option>
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" onClick={() => setShowMarketCol(v => !v)}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${showMarketCol ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>
          vs. Market {marketLoading && '…'}
        </button>
        <button type="button" onClick={exportCSV}
          className="px-3 py-2 rounded-lg text-xs font-medium border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors">
          Export CSV
        </button>
        <span className="text-xs text-zinc-600 ml-auto">{total.toLocaleString()} cards</span>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-amber-700/40 rounded-xl">
          <span className="text-xs text-amber-400 font-semibold">{selected.size} selected</span>
          <div className="flex items-center gap-1 ml-2">
            {bulkReprice.open ? (
              <>
                <select title="Reprice mode" value={bulkReprice.mode} onChange={e => setBulkReprice(p => ({ ...p, mode: e.target.value as 'flat' | 'pct' }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none">
                  <option value="flat">Set price ($)</option>
                  <option value="pct">% adjust</option>
                </select>
                <input type="text" placeholder={bulkReprice.mode === 'flat' ? '4.99' : '+10%'}
                  value={bulkReprice.value} onChange={e => setBulkReprice(p => ({ ...p, value: e.target.value }))}
                  className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  onKeyDown={e => e.key === 'Enter' && repriceSelected()}
                />
                <button type="button" onClick={repriceSelected} className="px-2 py-1 text-xs rounded-lg bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors">Apply</button>
                <button type="button" onClick={() => setBulkReprice(p => ({ ...p, open: false }))} className="px-2 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
              </>
            ) : (
              <button type="button" onClick={() => setBulkReprice(p => ({ ...p, open: true }))}
                className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors">
                Reprice…
              </button>
            )}
          </div>
          <button type="button" onClick={repriceToMarket}
            className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors">
            Reprice to market
          </button>
          <button type="button" onClick={deleteSelected}
            className="px-3 py-1 text-xs rounded-lg border border-red-900 text-red-400 hover:border-red-600 transition-colors ml-auto">
            Remove {selected.size}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 border-b border-zinc-800">
              <tr>
                <th className="w-8 px-3 py-3">
                  <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} className="accent-amber-400" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Card</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Type</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">C</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">CMC</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">Rarity</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Cond</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">Qty</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">Price</th>
                {showMarketCol && (
                  <th className="px-3 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">vs. Mkt</th>
                )}
                <th className="w-8 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading && (
                <tr><td colSpan={showMarketCol ? 11 : 10} className="px-4 py-8 text-center text-zinc-600 text-sm">Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={showMarketCol ? 11 : 10} className="px-4 py-8 text-center text-zinc-600 text-sm">No cards found</td></tr>
              )}
              {!loading && items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  saving={saving.has(item.id)}
                  showMarketCol={showMarketCol}
                  marketNode={showMarketCol ? vsMarket(item) : null}
                  onSelect={checked => {
                    setSelected(prev => { const s = new Set(prev); checked ? s.add(item.id) : s.delete(item.id); return s; });
                  }}
                  onPatch={(patch) => patchItem(item.id, patch)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page === 1} onClick={() => load(page - 1)}
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">
            ← Prev
          </button>
          <span className="text-xs text-zinc-500">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => load(page + 1)}
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item, selected, saving, showMarketCol, marketNode,
  onSelect, onPatch, onDelete,
}: {
  item: ShopInventoryItem;
  selected: boolean;
  saving: boolean;
  showMarketCol: boolean;
  marketNode: React.ReactNode;
  onSelect: (v: boolean) => void;
  onPatch: (patch: Record<string, number | string | boolean>) => void;
  onDelete: () => void;
}) {
  const [editQty, setEditQty] = useState(false);
  const [editPrice, setEditPrice] = useState(false);
  const [qtyVal, setQtyVal] = useState(String(item.quantity));
  const [priceVal, setPriceVal] = useState((item.priceCents / 100).toFixed(2));

  function commitQty() {
    setEditQty(false);
    const n = parseInt(qtyVal);
    if (!isNaN(n) && n > 0 && n !== item.quantity) onPatch({ quantity: n });
    else setQtyVal(String(item.quantity));
  }

  function commitPrice() {
    setEditPrice(false);
    const n = Math.round(parseFloat(priceVal) * 100);
    if (!isNaN(n) && n >= 0 && n !== item.priceCents) onPatch({ priceCents: n });
    else setPriceVal((item.priceCents / 100).toFixed(2));
  }

  const colors = parseColors(item.colors);

  return (
    <tr className={`group transition-colors ${selected ? 'bg-amber-950/10' : 'hover:bg-zinc-900/50'} ${saving ? 'opacity-60' : ''}`}>
      <td className="px-3 py-3">
        <input type="checkbox" aria-label={`Select $<CardNameLink name={item.cardName} imageUrl={item.imageUrl} />`} checked={selected} onChange={e => onSelect(e.target.checked)} className="accent-amber-400" />
      </td>
      <td className="px-3 py-3 min-w-48">
        <div className="font-medium text-zinc-200 leading-tight">{item.cardName}</div>
        <div className="text-xs text-zinc-600 mt-0.5">{item.setCode}{item.foil ? ' · Foil' : ''}</div>
      </td>
      <td className="px-3 py-3 hidden md:table-cell text-xs text-zinc-500 max-w-36">
        <span className="truncate block">{item.typeLine ?? '—'}</span>
      </td>
      <td className="px-3 py-3 hidden lg:table-cell">
        <div className="flex gap-0.5 justify-center">
          {colors.length === 0 && <span className="text-zinc-600 text-xs">—</span>}
          {colors.map(c => (
            <span key={c} className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-zinc-900 ${COLOR_MAP[c]?.bg ?? 'bg-zinc-500'}`}>
              {COLOR_MAP[c]?.label ?? c}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3 hidden lg:table-cell text-center text-xs text-zinc-400">
        {item.cmc ?? '—'}
      </td>
      <td className={`px-3 py-3 hidden lg:table-cell text-center text-xs font-medium ${RARITY_COLOR[item.rarity ?? ''] ?? 'text-zinc-500'}`}>
        {item.rarity ? item.rarity[0].toUpperCase() : '—'}
      </td>
      <td className="px-3 py-3">
        <select
          title="Condition"
          value={item.condition}
          onChange={e => onPatch({ condition: e.target.value })}
          className="bg-transparent border border-zinc-700 rounded-md px-1.5 py-1 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="px-3 py-3 text-center">
        {editQty ? (
          <input
            type="number" min={1} value={qtyVal} autoFocus
            onChange={e => setQtyVal(e.target.value)}
            onBlur={commitQty}
            onKeyDown={e => { if (e.key === 'Enter') commitQty(); if (e.key === 'Escape') { setEditQty(false); setQtyVal(String(item.quantity)); } }}
            className="w-14 bg-zinc-800 border border-amber-500 rounded-md px-2 py-1 text-xs text-center text-zinc-200 focus:outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditQty(true)}
            className="w-12 text-xs text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 rounded-md px-2 py-1 transition-colors">
            ×{item.quantity}
          </button>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {editPrice ? (
          <input
            type="number" min={0} step={0.01} value={priceVal} autoFocus
            onChange={e => setPriceVal(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={e => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') { setEditPrice(false); setPriceVal((item.priceCents / 100).toFixed(2)); } }}
            className="w-20 bg-zinc-800 border border-amber-500 rounded-md px-2 py-1 text-xs text-right text-zinc-200 focus:outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditPrice(true)}
            className="text-xs text-amber-400 hover:text-amber-300 hover:bg-zinc-800 rounded-md px-2 py-1 transition-colors">
            {fmt(item.priceCents)}
          </button>
        )}
      </td>
      {showMarketCol && (
        <td className="px-3 py-3 text-center text-xs">{marketNode}</td>
      )}
      <td className="px-3 py-3">
        <button type="button" onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-sm leading-none">
          ×
        </button>
      </td>
    </tr>
  );
}
