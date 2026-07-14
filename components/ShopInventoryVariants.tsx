'use client';

import { useEffect, useState } from 'react';
import { CardNameLink } from '@/components/CardNameLink';
import type { InventoryVariantCard } from '@/app/api/shops/inventory/variants/route';

const CONDITION_LABEL: Record<string, string> = {
  NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played',
  HP: 'Heavily Played', DMG: 'Damaged',
};

const PAGE_SIZE = 20;

export default function ShopInventoryVariants() {
  const [cards, setCards] = useState<InventoryVariantCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch('/api/shops/inventory/variants')
      .then(r => r.json())
      .then(d => setCards(d.cards ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="text-sm text-zinc-500 py-4">Loading variant stock...</div>
  );

  if (cards.length === 0) return (
    <div className="text-sm text-zinc-500 py-4">No cards with multiple variants in stock.</div>
  );

  const totalPages = Math.ceil(cards.length / PAGE_SIZE);
  const visible = cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{cards.length} card{cards.length !== 1 ? 's' : ''} with multiple variants</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 rounded bg-zinc-800 disabled:opacity-30 hover:bg-zinc-700">←</button>
            <span>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              className="px-2 py-1 rounded bg-zinc-800 disabled:opacity-30 hover:bg-zinc-700">→</button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {visible.map(card => (
          <div key={card.cardName} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="flex items-start gap-3">
              {card.imageUrl && (
                <img src={card.imageUrl} alt={card.cardName}
                  className="w-10 h-14 rounded object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-sm font-semibold truncate">
                    <CardNameLink name={card.cardName} />
                  </div>
                  <div className="text-xs text-zinc-500 shrink-0">{card.totalQuantity} total</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {card.variants.map((v, i) => (
                    <div key={i}
                      className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-2 py-1 text-xs">
                      <span className="text-zinc-300">{CONDITION_LABEL[v.condition] ?? v.condition}</span>
                      {v.foil && <span className="text-amber-400 font-medium">Foil</span>}
                      <span className="text-zinc-500">·</span>
                      <span className="font-medium tabular-nums">×{v.quantity}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-400">${(v.priceCents / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
