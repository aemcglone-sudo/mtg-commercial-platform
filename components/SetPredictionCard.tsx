'use client';

import Link from 'next/link';

interface SetPredictionRow {
  scryfallId: string; cardName: string; currentPrice: number; targetPrice6m: number | null;
  confidencePct: number; predictionDirection: string; matchedPattern: string;
}
interface SetPrediction {
  totalCards: number; bullishCount: number; bearishCount: number; neutralCount: number;
  avgTargetPct: number | null; avgConfidencePct: number | null; direction: string;
  chaseConcentrationPct: number | null; bullCase: string; bearCase: string;
  topBullish: SetPredictionRow[]; topBearish: SetPredictionRow[]; topValue: SetPredictionRow[];
}

const DIRECTION_STYLE: Record<string, string> = {
  bullish: 'bg-emerald-950/50 text-emerald-400 border-emerald-800',
  bearish: 'bg-red-950/50 text-red-400 border-red-800',
  neutral: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}
function fmtPct(n: number | null): string {
  if (n === null) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
}

function CardRow({ card }: { card: SetPredictionRow }) {
  return (
    <Link href={`/market/card/${card.scryfallId}`} className="flex items-center justify-between gap-2 text-sm hover:text-amber-400 transition-colors">
      <span className="truncate">{card.cardName}</span>
      <span className="text-zinc-500 text-xs shrink-0">{fmtUsd(card.currentPrice)} · {card.confidencePct.toFixed(0)}%</span>
    </Link>
  );
}

export default function SetPredictionCard({ prediction }: { prediction: SetPrediction }) {
  const { totalCards, bullishCount, bearishCount, neutralCount, avgTargetPct, avgConfidencePct, direction, chaseConcentrationPct, bullCase, bearCase, topBullish, topBearish, topValue } = prediction;

  const bullishPct = (bullishCount / totalCards) * 100;
  const neutralPct = (neutralCount / totalCards) * 100;
  const bearishPct = (bearishCount / totalCards) * 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-wide text-zinc-500">6-Month Set Forecast</p>
        <span className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${DIRECTION_STYLE[direction]}`}>
          {direction}
        </span>
      </div>

      <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
        <div>
          <p className="text-3xl font-bold text-zinc-100">{fmtPct(avgTargetPct)}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Average of every tracked card's own 6-month prediction, across all {totalCards} cards in this set — not one card, the whole set's average.
          </p>
        </div>
        <div className="text-right min-w-[140px]">
          <span className="text-xs text-zinc-500">Avg. confidence</span>
          <p className="text-sm font-semibold text-zinc-200">{avgConfidencePct !== null ? `${avgConfidencePct.toFixed(0)}%` : '—'}</p>
        </div>
      </div>

      {/* Composition bar */}
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">Card predictions</p>
        <p className="text-xs text-zinc-500 mb-1.5">How the {totalCards} individual card predictions split — this is what the average above is built from.</p>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-800">
          {bullishPct > 0 && <div className="bg-emerald-500" style={{ width: `${bullishPct}%` }} title={`${bullishCount} bullish`} />}
          {neutralPct > 0 && <div className="bg-zinc-600" style={{ width: `${neutralPct}%` }} title={`${neutralCount} neutral`} />}
          {bearishPct > 0 && <div className="bg-red-500" style={{ width: `${bearishPct}%` }} title={`${bearishCount} bearish`} />}
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
          <span className="text-emerald-500">{bullishCount} bullish</span>
          <span>{neutralCount} neutral</span>
          <span className="text-red-500">{bearishCount} bearish</span>
        </div>
      </div>

      {/* Chase concentration */}
      {chaseConcentrationPct !== null && (
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">Value distribution</p>
          <p className="text-xs text-zinc-500 mb-1.5">
            Add up the price of all {totalCards} cards in this set — what share of that total comes from just the 5 most expensive ones?
          </p>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={chaseConcentrationPct > 70 ? 'h-full bg-amber-500' : 'h-full bg-zinc-500'}
              style={{ width: `${Math.min(chaseConcentrationPct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 mt-1.5">
            {chaseConcentrationPct.toFixed(0)}% of this set's total value is in just its 5 priciest cards (out of {totalCards} tracked).
          </p>
          {chaseConcentrationPct > 70 && (
            <p className="text-xs text-amber-500 mt-0.5">⚠ High concentration — this set's value rides heavily on a few chase cards; if one of those reprints or falls out of favor, the whole set's value drops with it.</p>
          )}
          {chaseConcentrationPct < 50 && (
            <p className="text-xs text-emerald-500 mt-0.5">✓ Well distributed — value spread across many playable cards, not riding on a couple of chase pieces.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-emerald-500 font-semibold mb-1">Bull case</p>
          <p className="text-xs text-zinc-300">{bullCase}</p>
        </div>
        <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-red-500 font-semibold mb-1">Bear case</p>
          <p className="text-xs text-zinc-300">{bearCase}</p>
        </div>
      </div>

      {(topBullish.length > 0 || topBearish.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {topBullish.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Top bullish plays</p>
              <div className="space-y-1.5">
                {topBullish.map(c => <CardRow key={c.scryfallId} card={c} />)}
              </div>
            </div>
          )}
          {topBearish.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Fade candidates</p>
              <div className="space-y-1.5">
                {topBearish.map(c => <CardRow key={c.scryfallId} card={c} />)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-zinc-800 text-[10px] text-zinc-600">
        Aggregated from {totalCards} per-card heuristic predictions — not backtested. Rotation risk isn't factored in (we don't track format rotation dates).
      </div>
    </div>
  );
}
