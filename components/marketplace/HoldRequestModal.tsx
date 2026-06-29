'use client';

import { useState } from 'react';

interface InventoryItem {
  inventoryId: string;
  shopName: string;
  shopId: string;
  cardName: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  holdInstructions?: string;
}

interface Props {
  item: InventoryItem;
  sourceDeckId?: string;
  sourceListId?: string;
  sourceCampaignId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function HoldRequestModal({ item, sourceDeckId, sourceListId, sourceCampaignId, onClose, onSuccess }: Props) {
  const [pickupWindow, setPickupWindow] = useState('');
  const [collectorNote, setCollectorNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/marketplace/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: item.inventoryId,
          pickupWindow: pickupWindow || undefined,
          collectorNote: collectorNote || undefined,
          sourceDeckId,
          sourceListId,
          sourceCampaignId,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to request hold'); setSubmitting(false); return; }
      onSuccess();
    } catch {
      setError('Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Request a Hold</h2>
            <p className="text-sm text-zinc-500 mt-0.5">The shop will confirm availability</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors text-lg">✕</button>
        </div>

        {/* Card summary */}
        <div className="bg-zinc-800 rounded-xl p-4 space-y-1">
          <p className="font-medium text-zinc-100">{item.cardName}</p>
          <p className="text-sm text-zinc-400">{item.condition}{item.foil ? ' · Foil' : ''} · <span className="text-amber-400 font-semibold">${(item.priceCents / 100).toFixed(2)}</span></p>
          <p className="text-sm text-zinc-500">{item.shopName}</p>
        </div>

        {item.holdInstructions && (
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg px-3 py-2 text-xs text-blue-300">
            {item.holdInstructions}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Availability for pickup <span className="text-zinc-600">(optional)</span></label>
            <input
              type="text"
              value={pickupWindow}
              onChange={e => setPickupWindow(e.target.value)}
              placeholder="e.g. Saturday afternoon, weekday evenings after 5pm"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Note to shop <span className="text-zinc-600">(optional)</span></label>
            <textarea
              value={collectorNote}
              onChange={e => setCollectorNote(e.target.value)}
              placeholder="Anything the shop should know…"
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="text-xs text-zinc-600 leading-relaxed">
          The shop has 24 hours to confirm. Once confirmed, you have 72 hours to pick up. No payment is collected online — transaction happens in store.
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Request Hold'}
          </button>
        </div>
      </div>
    </div>
  );
}
