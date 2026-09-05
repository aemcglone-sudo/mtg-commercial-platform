'use client';

interface DominantSignal { signal: string; value: string | number | null; }

interface CardPrediction {
  date: string;
  currentPrice: number | null;
  targetPrice6m: number | null;
  targetPrice6mLow: number | null;
  targetPrice6mHigh: number | null;
  confidencePct: number | null;
  predictionDirection: string | null;
  matchedPattern: string | null;
  dominantSignals: DominantSignal[];
  upsideScenario: string | null;
  upsideTarget: number | null;
  downsideScenario: string | null;
  downsideTarget: number | null;
  riskFactors: string[];
}

const PATTERN_LABELS: Record<string, string> = {
  hype_spike_fade: 'Hype Spike Fade',
  supply_flood_continuation: 'Supply Flood Continuation',
  stabilization_hold: 'Stabilization Hold',
  undervalued_in_set: 'Undervalued In Set',
  overextended_in_set: 'Overextended In Set',
  fallback_neutral: 'No Strong Pattern',
};

const SIGNAL_LABELS: Record<string, string> = {
  release_phase: 'Release phase',
  momentum_7d: '7d momentum',
  momentum_30d: '30d momentum',
  momentum_90d: '90d momentum',
  price_vs_set_median: 'vs. set median',
};

const DIRECTION_STYLE: Record<string, string> = {
  bullish: 'bg-emerald-950/50 text-emerald-400 border-emerald-800',
  bearish: 'bg-red-950/50 text-red-400 border-red-800',
  neutral: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

function fmtUsd(n: number | null): string {
  return n === null ? '—' : `$${n.toFixed(2)}`;
}

function fmtSignalValue(signal: string, value: string | number | null): string {
  if (value === null) return '—';
  if (signal === 'release_phase') return String(value).replace('_', ' ');
  if (typeof value === 'number') {
    if (signal === 'price_vs_set_median') return `${value.toFixed(2)}×`;
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
  }
  return String(value);
}

function confidenceColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-red-500';
}

interface CardNews {
  hasNews: boolean;
  summary: string | null;
  category: string | null;
  sourceUrls: string[];
  confidence: number | null;
  fetchedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  reprint: 'Reprint', banned: 'Ban/Unban', tournament: 'Tournament result', set_synergy: 'New set synergy', other: 'News',
};

export default function PredictionCard({ prediction, news }: { prediction: CardPrediction; news?: CardNews | null }) {
  const {
    currentPrice, targetPrice6m, targetPrice6mLow, targetPrice6mHigh, confidencePct,
    predictionDirection, matchedPattern, dominantSignals, upsideScenario, upsideTarget,
    downsideScenario, downsideTarget, riskFactors,
  } = prediction;

  const direction = predictionDirection ?? 'neutral';
  const conf = confidencePct ?? 0;

  // Position markers along a simple horizontal range: downside — low — target — high — upside
  const points = [downsideTarget, targetPrice6mLow, targetPrice6m, targetPrice6mHigh, upsideTarget]
    .filter((p): p is number => p !== null);
  const min = points.length ? Math.min(...points, currentPrice ?? Infinity) : 0;
  const max = points.length ? Math.max(...points, currentPrice ?? 0) : 1;
  const span = max - min || 1;
  const posPct = (v: number | null) => v === null ? null : ((v - min) / span) * 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-wide text-zinc-500">6-Month Speculation Forecast</p>
        <span className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${DIRECTION_STYLE[direction]}`}>
          {direction}
        </span>
      </div>

      <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
        <div>
          <p className="text-3xl font-bold text-zinc-100">{fmtUsd(targetPrice6m)}</p>
          <p className="text-xs text-zinc-500 mt-0.5">target · from {fmtUsd(currentPrice)} today</p>
        </div>
        <div className="text-right min-w-[140px]">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-xs text-zinc-500">Confidence</span>
            <span className="text-sm font-semibold text-zinc-200">{conf.toFixed(0)}%</span>
          </div>
          <div className="w-36 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className={`h-full ${confidenceColor(conf)}`} style={{ width: `${conf}%` }} />
          </div>
        </div>
      </div>

      {/* Range visual */}
      {points.length > 0 && (
        <div className="mb-6">
          <div className="relative h-1.5 rounded-full bg-zinc-800 mx-2">
            {downsideTarget !== null && posPct(downsideTarget) !== null && (
              <div className="absolute w-2 h-2 rounded-full bg-red-500 -top-0.5" style={{ left: `${posPct(downsideTarget)}%`, transform: 'translateX(-50%)' }} title={`Downside ${fmtUsd(downsideTarget)}`} />
            )}
            {targetPrice6m !== null && posPct(targetPrice6m) !== null && (
              <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-400 -top-0.5" style={{ left: `${posPct(targetPrice6m)}%`, transform: 'translateX(-50%)' }} title={`Target ${fmtUsd(targetPrice6m)}`} />
            )}
            {upsideTarget !== null && posPct(upsideTarget) !== null && (
              <div className="absolute w-2 h-2 rounded-full bg-emerald-500 -top-0.5" style={{ left: `${posPct(upsideTarget)}%`, transform: 'translateX(-50%)' }} title={`Upside ${fmtUsd(upsideTarget)}`} />
            )}
            {currentPrice !== null && posPct(currentPrice) !== null && (
              <div className="absolute w-0.5 h-3 bg-zinc-400 -top-[3px]" style={{ left: `${posPct(currentPrice)}%` }} title={`Current ${fmtUsd(currentPrice)}`} />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5 px-2">
            <span>{fmtUsd(downsideTarget)}</span>
            <span className="text-amber-500">{fmtUsd(targetPrice6m)}</span>
            <span>{fmtUsd(upsideTarget)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-emerald-500 font-semibold mb-1">Upside case</p>
          <p className="text-sm font-semibold text-zinc-100 mb-1">{fmtUsd(upsideTarget)}</p>
          {upsideScenario && <p className="text-xs text-zinc-400">{upsideScenario}</p>}
        </div>
        <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-red-500 font-semibold mb-1">Downside case</p>
          <p className="text-sm font-semibold text-zinc-100 mb-1">{fmtUsd(downsideTarget)}</p>
          {downsideScenario && <p className="text-xs text-zinc-400">{downsideScenario}</p>}
        </div>
      </div>

      {news?.hasNews && news.summary && (
        <div className="mb-4 bg-sky-950/20 border border-sky-900/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-sky-400 font-semibold mb-1">
            Why{news.category ? ` — ${CATEGORY_LABELS[news.category] ?? news.category}` : ''}
          </p>
          <p className="text-sm text-zinc-200 mb-1.5">{news.summary}</p>
          {news.sourceUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {news.sourceUrls.slice(0, 3).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-500 hover:text-sky-400 truncate max-w-[200px]">
                  {new URL(url).hostname.replace('www.', '')} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {dominantSignals.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Key signals</p>
          <div className="flex flex-wrap gap-2">
            {dominantSignals.map((s, i) => (
              <span key={i} className="text-xs bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-1 text-zinc-300">
                {SIGNAL_LABELS[s.signal] ?? s.signal}: <span className="text-zinc-100 font-medium">{fmtSignalValue(s.signal, s.value)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {riskFactors.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wide text-amber-500 font-semibold mb-1.5">⚠ Risk factors</p>
          <ul className="space-y-1">
            {riskFactors.map((r, i) => (
              <li key={i} className="text-xs text-zinc-400">{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600">
        <span>Pattern: {matchedPattern ? PATTERN_LABELS[matchedPattern] ?? matchedPattern : '—'}</span>
        <span title="Confidence reflects pattern-match strength, not backtested accuracy — no prediction has had 6 months to actually resolve yet.">
          Heuristic call, not yet backtested ⓘ
        </span>
      </div>
    </div>
  );
}
