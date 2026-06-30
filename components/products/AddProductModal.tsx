'use client';

import { useState, useEffect, useRef } from 'react';

interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  product_type: string;
  set_code: string | null;
  set_name: string | null;
  msrp_cents: number | null;
  image_url: string | null;
  description: string | null;
}

interface AddProductModalProps {
  onClose: () => void;
  onAdded: () => void;
}

const FULFILLMENT_OPTIONS = [
  { value: 'pickup', label: 'In-store pickup only' },
  { value: 'ship', label: 'Ship only' },
  { value: 'both', label: 'Pickup or ship' },
];

const CATEGORIES: { value: string; label: string; type: 'sealed' | 'accessory' }[] = [
  { value: 'booster_box', label: 'Booster Box', type: 'sealed' },
  { value: 'collector_box', label: 'Collector Box', type: 'sealed' },
  { value: 'bundle', label: 'Bundle', type: 'sealed' },
  { value: 'commander_precon', label: 'Commander Precon', type: 'sealed' },
  { value: 'prerelease_kit', label: 'Prerelease Kit', type: 'sealed' },
  { value: 'starter_deck', label: 'Starter Deck', type: 'sealed' },
  { value: 'other_sealed', label: 'Other Sealed', type: 'sealed' },
  { value: 'sleeve', label: 'Sleeves', type: 'accessory' },
  { value: 'deck_box', label: 'Deck Box', type: 'accessory' },
  { value: 'playmat', label: 'Playmat', type: 'accessory' },
  { value: 'dice', label: 'Dice', type: 'accessory' },
  { value: 'binder', label: 'Binder', type: 'accessory' },
  { value: 'storage_box', label: 'Storage', type: 'accessory' },
  { value: 'other_accessory', label: 'Other Accessory', type: 'accessory' },
];

function fmtMsrp(cents: number | null) {
  if (!cents) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AddProductModal({ onClose, onAdded }: AddProductModalProps) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [searching, setSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');

  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [fulfillment, setFulfillment] = useState('pickup');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (selected || showManual) return;
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=50`);
        const data = await res.json() as { items: CatalogProduct[] };
        setResults(data.items ?? []);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, selected, showManual]);

  async function handleSave() {
    const priceCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceCents) || priceCents <= 0) { setError('Enter a valid price'); return; }
    const quantity = parseInt(qty);
    if (isNaN(quantity) || quantity < 0) { setError('Enter a valid quantity'); return; }

    const body = selected
      ? { productId: selected.id, quantity, priceCents, fulfillmentType: fulfillment, notes: notes.trim() || undefined }
      : { name: manualName.trim(), category: manualCategory, productType: CATEGORIES.find(c => c.value === manualCategory)?.type ?? 'sealed', quantity, priceCents, fulfillmentType: fulfillment, notes: notes.trim() || undefined };

    if (!selected) {
      if (!manualName.trim()) { setError('Enter a product name'); return; }
      if (!manualCategory) { setError('Select a category'); return; }
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/shops/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to add');
      }
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add product');
      setSaving(false);
    }
  }

  const showForm = selected || showManual;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-semibold">Add Product</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {!showForm ? (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Search products</label>
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Type a product name, set, or category…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />

              {searching && <p className="text-xs text-zinc-500 mt-2">Searching…</p>}

              {results.length > 0 && (
                <div className="mt-2 border border-zinc-700 rounded-lg overflow-y-auto max-h-72 divide-y divide-zinc-800">
                  {results.map(p => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        setSelected(p);
                        if (p.msrp_cents) setPrice((p.msrp_cents / 100).toFixed(2));
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-zinc-800 transition-colors"
                    >
                      <div className="text-sm text-zinc-100 leading-snug">{p.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {p.set_name ?? p.category}
                        {p.msrp_cents ? ` · MSRP ${fmtMsrp(p.msrp_cents)}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {q.trim() && !searching && results.length === 0 && (
                <p className="text-xs text-zinc-500 mt-2">No results for &ldquo;{q}&rdquo;</p>
              )}

              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 underline"
              >
                Can&apos;t find it? Add manually
              </button>
            </div>
          ) : (
            <div>
              {/* Selected product header or manual name/category */}
              {selected ? (
                <div className="flex items-start gap-3 mb-4 p-3 bg-zinc-800 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 leading-snug">{selected.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {selected.set_name ?? selected.category}
                      {selected.msrp_cents ? ` · MSRP ${fmtMsrp(selected.msrp_cents)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelected(null); setQ(''); setResults([]); setError(''); setPrice(''); }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  <div>
                    <label htmlFor="manual-name" className="block text-xs font-medium text-zinc-400 mb-1">Product name</label>
                    <input
                      id="manual-name"
                      autoFocus
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      placeholder="e.g. Dragon Shield Matte Sleeves Black"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="manual-category" className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
                    <select
                      id="manual-category"
                      value={manualCategory}
                      onChange={e => setManualCategory(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    >
                      <option value="">Select a category…</option>
                      <optgroup label="Sealed Products">
                        {CATEGORIES.filter(c => c.type === 'sealed').map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Accessories">
                        {CATEGORIES.filter(c => c.type === 'accessory').map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowManual(false); setError(''); }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                  >
                    ← Back to search
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="product-qty" className="block text-xs font-medium text-zinc-400 mb-1">Quantity</label>
                  <input
                    id="product-qty"
                    type="number" min="0" value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label htmlFor="product-price" className="block text-xs font-medium text-zinc-400 mb-1">
                    Your price ($)
                    {selected?.msrp_cents && <span className="text-zinc-600 font-normal ml-1">MSRP {fmtMsrp(selected.msrp_cents)}</span>}
                  </label>
                  <input
                    id="product-price"
                    type="number" min="0" step="0.01" value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label htmlFor="product-fulfillment" className="block text-xs font-medium text-zinc-400 mb-1">Fulfillment</label>
                <select
                  id="product-fulfillment"
                  value={fulfillment}
                  onChange={e => setFulfillment(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  {FULFILLMENT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="mt-3">
                <label htmlFor="product-notes" className="block text-xs font-medium text-zinc-400 mb-1">Notes (optional)</label>
                <input
                  id="product-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Condition notes, limited quantity, etc."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </div>
          )}
        </div>

        {showForm && (
          <div className="px-5 pb-5 flex gap-3 shrink-0 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding…' : 'Add to Inventory'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
