'use client';

import { useState, useEffect } from 'react';
import type { CollectionCardData } from './CollectionBrowser';

interface CardDetailModalProps {
  cardName: string | null;
  onClose: () => void;
  collectionCard?: CollectionCardData | null;
}

interface ScryfallCard {
  name: string;
  image_uris?: { normal: string; large: string };
  card_faces?: Array<{ image_uri: string }>;
  type_line: string;
  oracle_text: string;
  mana_cost: string;
  cmc: number;
  rarity: string;
  set_name: string;
  prices: { usd: string | null };
}

export default function CardDetailModal({ cardName, onClose, collectionCard }: CardDetailModalProps) {
  const [scryfallCard, setScryfallCard] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cardName) return;

    setLoading(true);
    setError('');

    // Fetch from Scryfall if not in collection
    if (!collectionCard) {
      fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.object === 'error') {
            setError('Card not found');
          } else {
            setScryfallCard(data);
          }
        })
        .catch(() => setError('Failed to load card'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [cardName, collectionCard]);

  if (!cardName) return null;

  const card = collectionCard || scryfallCard;
  const imageUrl = collectionCard?.imageUrl || scryfallCard?.image_uris?.large || scryfallCard?.image_uris?.normal;
  const isInCollection = !!collectionCard;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-200">{cardName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Status badge */}
          {!isInCollection && (
            <div className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300">
              ⓘ Not in your collection
            </div>
          )}

          {isInCollection && (
            <div className="px-3 py-2 rounded bg-green-900/30 border border-green-700 text-xs font-medium text-green-300">
              ✓ In your collection ({collectionCard?.quantity}x)
            </div>
          )}

          {/* Card image */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt={cardName}
              className="w-full max-w-sm rounded-lg border border-zinc-700 mx-auto"
            />
          )}

          {/* Card details */}
          {loading && <p className="text-sm text-zinc-500">Loading card details...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {card && (
            <div className="space-y-3 text-sm">
              {/* Type line */}
              {(card as any).type_line && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Type</p>
                  <p className="text-zinc-300">{(card as any).type_line}</p>
                </div>
              )}

              {/* Mana cost */}
              {(card as any).mana_cost && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Mana Cost</p>
                  <p className="text-zinc-300">{(card as any).mana_cost}</p>
                </div>
              )}

              {/* Oracle text */}
              {(card as any).oracle_text && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Abilities</p>
                  <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">
                    {(card as any).oracle_text}
                  </p>
                </div>
              )}

              {/* Rarity & Set */}
              <div className="flex gap-3 text-xs text-zinc-400">
                {(card as any).rarity && <span>Rarity: {(card as any).rarity}</span>}
                {(card as any).set_name && <span>Set: {(card as any).set_name}</span>}
              </div>

              {/* Price */}
              {!isInCollection && (card as any).prices?.usd && (
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Price (Scryfall)</p>
                  <p className="text-amber-400 font-medium">${(card as any).prices.usd}</p>
                </div>
              )}

              {isInCollection && collectionCard?.priceUsd && (
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Your Value</p>
                  <p className="text-amber-400 font-medium">${(collectionCard.priceUsd * collectionCard.quantity).toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
