'use client';

import { useState } from 'react';
import type { MatchedDeck, HaveCard, GapCard } from '@/lib/deck-matcher';

const FORMAT_COLORS: Record<string, string> = {
  Standard: 'bg-blue-900/60 text-blue-300',
  Pioneer: 'bg-purple-900/60 text-purple-300',
  Commander: 'bg-green-900/60 text-green-300',
};

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function CardRow({ name, qty, label, price, variant }: {
  name: string; qty: string; label?: string; price: number | null; variant: 'have' | 'need';
}) {
  return (
    <div className={`flex items-center justify-between gap-3 text-sm py-1.5 border-b border-zinc-800/50 last:border-0`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-xs font-bold shrink-0 ${variant === 'have' ? 'text-emerald-500' : 'text-red-400'}`}>
          {variant === 'have' ? '✓' : '✕'}
        </span>
        <span className="font-mono text-xs text-zinc-500 shrink-0 w-6">{qty}</span>
        <a
          href={`https://scryfall.com/search?q=!"${encodeURIComponent(name)}"&as=grid`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-200 hover:text-amber-400 truncate transition-colors"
        >
          {name}
        </a>
        {label && <span className="text-zinc-600 text-xs shrink-0">{label}</span>}
      </div>
      {price !== null && price > 0 ? (
        <span className="text-zinc-500 shrink-0 font-mono text-xs">${price.toFixed(2)}</span>
      ) : (
        <span className="text-zinc-700 shrink-0 text-xs">—</span>
      )}
    </div>
  );
}

interface Props {
  deck: Omit<MatchedDeck, 'cards'>;
  rank?: number;
  onSave?: () => void;
  collectionType?: 'paper' | 'arena';
  collection?: Array<{ name: string; collectionType?: 'paper' | 'arena' }>;
}

export default function DeckCard({ deck, rank, onSave, collectionType = 'paper', collection = [] }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'all' | 'have' | 'need'>('all');

  const formatBadge = FORMAT_COLORS[deck.format] ?? 'bg-zinc-800 text-zinc-300';

  // Build collection map filtered by type
  const collectionMap = new Map(
    collection
      .filter(c => (c.collectionType ?? 'paper') === collectionType)
      .map(c => [c.name, true])
  );

  // Recalculate coverage for selected collection type
  const filteredHaveCards = deck.haveCards.filter(c => collectionMap.has(c.name));
  const filteredGapCards = deck.gapCards.map(c => {
    const owned = collectionMap.has(c.name) ? c.owned : 0;
    return { ...c, owned, shortage: c.needed - owned };
  }).filter(c => c.shortage > 0);

  const totalCards = [...filteredHaveCards, ...filteredGapCards].reduce((sum, c) => sum + c.needed, 0);
  const ownedCards = filteredHaveCards.reduce((sum, c) => sum + c.needed, 0);
  const coveragePct = totalCards > 0 ? (ownedCards / totalCards) * 100 : 0;
  const pct = Math.round(coveragePct);
  const completeCost = filteredGapCards.reduce((sum, c) => sum + (c.priceUsd ?? 0) * c.shortage, 0) || null;

  // Calculate total deck cost and owned value
  const ownedValue = filteredHaveCards.reduce((sum, c) => sum + (c.priceUsd ?? 0) * c.needed, 0);
  const missingCost = filteredGapCards.reduce((sum, c) => sum + (c.priceUsd ?? 0) * c.shortage, 0);
  const totalCost = ownedValue + missingCost;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-colors">
      {/* ── Summary row (always visible) ───────────────────────────── */}
      <div className="p-5 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="flex-1 text-left flex items-start gap-3 min-w-0"
            onClick={() => setExpanded((v) => !v)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {rank !== undefined && (
                <span className="text-2xl font-black text-zinc-600 leading-none w-8 shrink-0">
                  #{rank + 1}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-zinc-100 truncate">{deck.name}</h3>
                {deck.commanderName && (
                  <p className="text-xs text-zinc-500 mt-0.5">Commander: {deck.commanderName}</p>
                )}
              </div>
            </div>
          </button>

          {/* Right side: badges + save button */}
          <div className="flex items-start gap-2 shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${formatBadge}`}>
              {deck.format}
            </span>
            {onSave && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors shrink-0"
                title="Save to My Decks"
              >
                + Save
              </button>
            )}
          </div>
        </div>

        {/* Coverage bar - clickable */}
        <button
          type="button"
          className="w-full text-left space-y-2"
          onClick={() => setExpanded((v) => !v)}
        >
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">
                <span className="text-emerald-400 font-medium">{ownedCards}</span>
                <span className="text-zinc-600"> / {totalCards} cards owned</span>
              </span>
              <span className={`font-semibold ${pct >= 90 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                {pct}%
              </span>
            </div>
            <CoverageBar pct={pct} />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">
              {filteredGapCards.length === 0
                ? '✓ Ready to build!'
                : `${filteredGapCards.reduce((s, c) => s + c.shortage, 0)} card${filteredGapCards.reduce((s, c) => s + c.shortage, 0) !== 1 ? 's' : ''} still needed`}
            </span>
            <span className="text-zinc-600 text-xs">{expanded ? '▲ Hide' : '▼ Show cards'}</span>
          </div>

          {/* Price breakdown */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Deck price</span>
              <span className="font-semibold text-amber-400">${totalCost > 0 ? totalCost.toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">You have</span>
              <span className="text-emerald-400">${ownedValue > 0 ? ownedValue.toFixed(2) : '0.00'}</span>
            </div>
            {missingCost > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Need to acquire</span>
                <span className="text-red-400 font-semibold">${missingCost.toFixed(2)}</span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* ── Expanded card list ──────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-zinc-800">
          {filteredGapCards.length === 0 ? (
            <p className="p-5 text-center text-emerald-400 text-sm font-medium">
              You own every card in this deck!
            </p>
          ) : (
            <>
              {/* Tab switcher */}
              <div className="flex border-b border-zinc-800 text-xs font-medium">
                {([
                  { id: 'all',  label: `All (${totalCards})` },
                  { id: 'have', label: `✓ Have (${filteredHaveCards.length})` },
                  { id: 'need', label: `✕ Need (${filteredGapCards.length})` },
                ] as { id: typeof tab; label: string }[]).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex-1 py-2.5 transition-colors ${
                      tab === id
                        ? id === 'have'
                          ? 'text-emerald-400 border-b-2 border-emerald-500'
                          : id === 'need'
                          ? 'text-red-400 border-b-2 border-red-500'
                          : 'text-amber-400 border-b-2 border-amber-400'
                        : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Card rows */}
              <div className="p-4 max-h-72 overflow-y-auto space-y-0">
                {(tab === 'all' || tab === 'have') && filteredHaveCards.length > 0 && (
                  <>
                    {tab === 'all' && (
                      <p className="text-xs text-emerald-600 font-semibold pb-1 pt-0.5 uppercase tracking-wide">
                        In your collection
                      </p>
                    )}
                    {filteredHaveCards.map((c: HaveCard) => (
                      <CardRow
                        key={`have-${c.name}`}
                        name={c.name}
                        qty={`×${Math.min(c.owned, c.needed)}`}
                        label={c.owned > c.needed ? `(own ${c.owned})` : undefined}
                        price={c.priceUsd}
                        variant="have"
                      />
                    ))}
                  </>
                )}

                {tab === 'all' && filteredGapCards.length > 0 && filteredHaveCards.length > 0 && (
                  <div className="py-2" />
                )}

                {(tab === 'all' || tab === 'need') && filteredGapCards.length > 0 && (
                  <>
                    {tab === 'all' && (
                      <p className="text-xs text-red-600 font-semibold pb-1 uppercase tracking-wide">
                        Still needed
                      </p>
                    )}

                    {/* Specialty lands — shown first with extra callout */}
                    {filteredGapCards.some((c) => c.isLand) && (
                      <>
                        <p className="text-xs text-amber-500 font-semibold pb-0.5 pt-1 flex items-center gap-1">
                          🏔️ Specialty lands required
                        </p>
                        {filteredGapCards.filter((c) => c.isLand).map((c) => (
                          <CardRow
                            key={`need-land-${c.name}`}
                            name={c.name}
                            qty={`×${c.shortage}`}
                            label={c.owned > 0 ? `(own ${c.owned})` : undefined}
                            price={c.priceUsd ? c.priceUsd * c.shortage : null}
                            variant="need"
                          />
                        ))}
                        {filteredGapCards.some((c) => !c.isLand) && (
                          <p className="text-xs text-red-600 font-semibold pb-0.5 pt-2 uppercase tracking-wide">
                            Spells & other cards
                          </p>
                        )}
                      </>
                    )}

                    {/* Non-land gap cards */}
                    {filteredGapCards.filter((c) => !c.isLand).map((c) => (
                      <CardRow
                        key={`need-${c.name}`}
                        name={c.name}
                        qty={`×${c.shortage}`}
                        label={c.owned > 0 ? `(own ${c.owned})` : undefined}
                        price={c.priceUsd ? c.priceUsd * c.shortage : null}
                        variant="need"
                      />
                    ))}

                    {tab === 'need' && completeCost !== null && (
                      <p className="text-xs text-zinc-500 pt-3 text-right">
                        Total to complete: <span className="text-amber-400 font-medium">${completeCost.toFixed(2)}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
