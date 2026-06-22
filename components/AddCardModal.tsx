'use client';

import { useState, useEffect } from 'react';

interface ScryfallCard {
  name: string;
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
  type_line?: string;
  mana_cost?: string;
  rarity?: string;
  set_name?: string;
  prices?: { usd?: string | null };
}

interface Props {
  cardName: string;
  onConfirm: (name: string, quantity: number) => Promise<void>;
  onClose: () => void;
}

export default function AddCardModal({ cardName, onConfirm, onClose }: Props) {
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [loadingCard, setLoadingCard] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingCard(true);
    fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`)
      .then(r => r.json())
      .then(data => {
        if (data.object === 'error') setError('Card not found on Scryfall');
        else setCard(data);
      })
      .catch(() => setError('Failed to load card details'))
      .finally(() => setLoadingCard(false));
  }, [cardName]);

  async function handleConfirm() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 50));
    try {
      await onConfirm(cardName, quantity);
      onClose();
    } catch {
      setError('Failed to add card');
    } finally {
      setSaving(false);
    }
  }

  const imageUrl = card?.image_uris?.normal ?? card?.card_faces?.[0]?.image_uris?.normal;
  const price = card?.prices?.usd ? `$${parseFloat(card.prices.usd).toFixed(2)}` : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-100 text-sm">Add to Collection</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loadingCard ? (
            <div className="text-center py-6 text-zinc-500 text-sm">Loading card…</div>
          ) : error ? (
            <div className="text-center py-6 text-red-400 text-sm">{error}</div>
          ) : card ? (
            <>
              {/* Card preview */}
              <div className="flex gap-3 items-start">
                {imageUrl && (
                  <img src={imageUrl} alt={card.name} className="w-20 rounded-lg border border-zinc-700 shrink-0" />
                )}
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-zinc-100 text-sm leading-tight">{card.name}</p>
                  {card.type_line && <p className="text-xs text-zinc-400">{card.type_line}</p>}
                  {card.set_name && <p className="text-xs text-zinc-500">{card.set_name}</p>}
                  {price && <p className="text-xs text-amber-400 font-medium">{price}</p>}
                  {card.rarity && <p className="text-xs text-zinc-500 capitalize">{card.rarity}</p>}
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-400">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-lg font-bold flex items-center justify-center"
                  >−</button>
                  <span className="w-8 text-center text-zinc-100 font-semibold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.min(99, q + 1))}
                    className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-lg font-bold flex items-center justify-center"
                  >+</button>
                </div>
              </div>

            </>
          ) : null}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-600 text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || loadingCard || !!error}
              className="flex-1 px-3 py-2 rounded-lg bg-amber-400 text-black font-medium text-sm hover:bg-amber-300 transition-colors disabled:opacity-40"
            >
              {saving ? (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  Adding…
                </span>
              ) : 'Add to Collection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
