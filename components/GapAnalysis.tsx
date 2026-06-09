'use client';

import type { GapCard } from '@/lib/deck-matcher';

interface Props {
  gapCards: GapCard[];
}

export default function GapAnalysis({ gapCards }: Props) {
  const totalCost = gapCards.reduce((s, c) => s + c.shortage * (c.priceUsd ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-300">Cards to Acquire</h4>
        {totalCost > 0 && (
          <span className="text-sm text-zinc-400">
            Total ~<span className="text-amber-400 font-medium">${totalCost.toFixed(2)}</span>
          </span>
        )}
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {gapCards.map((card) => (
          <div
            key={card.name}
            className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-zinc-800 last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-500 font-mono text-xs w-4 shrink-0">
                ×{card.shortage}
              </span>
              <a
                href={`https://scryfall.com/search?q=!"${encodeURIComponent(card.name)}"&as=grid`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-200 hover:text-amber-400 truncate transition-colors"
              >
                {card.name}
              </a>
              {card.owned > 0 && (
                <span className="text-zinc-600 text-xs shrink-0">
                  (own {card.owned})
                </span>
              )}
            </div>

            {card.priceUsd !== null ? (
              <span className="text-zinc-400 shrink-0 font-mono text-xs">
                ${(card.priceUsd * card.shortage).toFixed(2)}
              </span>
            ) : (
              <span className="text-zinc-700 shrink-0 text-xs">—</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-600">
        Prices from Scryfall · Click a card name to view on Scryfall
      </p>
    </div>
  );
}
