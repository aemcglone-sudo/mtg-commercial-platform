'use client';

import { useState } from 'react';

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

export default function AddProductModal({ onClose, onAdded }: AddProductModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [fulfillment, setFulfillment] = useState('pickup');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedCategory = CATEGORIES.find(c => c.value === category);

  async function handleSave() {
    if (!name.trim()) { setError('Enter a product name'); return; }
    if (!category) { setError('Select a category'); return; }
    const priceCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceCents) || priceCents <= 0) { setError('Enter a valid price'); return; }
    const quantity = parseInt(qty);
    if (isNaN(quantity) || quantity < 0) { setError('Enter a valid quantity'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/shops/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          productType: selectedCategory?.type ?? 'sealed',
          quantity,
          priceCents,
          fulfillmentType: fulfillment,
          notes: notes.trim() || undefined,
        }),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-semibold">Add Product</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Product name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Bloomburrow Booster Box"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="product-category" className="block text-xs font-medium text-zinc-400 mb-1.5">Category</label>
            <select
              id="product-category"
              value={category}
              onChange={e => setCategory(e.target.value)}
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
              <label className="block text-xs font-medium text-zinc-400 mb-1">Your price ($)</label>
              <input
                type="number" min="0" step="0.01" value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div>
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

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Condition notes, limited quantity, etc."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="px-5 pb-5 flex gap-3 shrink-0">
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
      </div>
    </div>
  );
}
