'use client';

interface BreadthPoint { date: string; advancers: number | null; decliners: number | null }

/** Diverging daily bar chart — advancers above a zero line, decliners
 * below. Paired with PriceChart's index line so "index up" (the line) and
 * "value rotating between cards" (a wide mixed spread here even on a flat
 * day) read as two distinct signals on the same timeline. */
export default function BreadthChart({ points, height = 100 }: { points: BreadthPoint[]; height?: number }) {
  const clean = points.filter((p): p is { date: string; advancers: number; decliners: number } => p.advancers !== null && p.decliners !== null);

  if (clean.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-zinc-600 border border-zinc-800 rounded-lg" style={{ height }}>
        No breadth data yet.
      </div>
    );
  }

  const width = 600;
  const padding = 4;
  const maxVal = Math.max(...clean.map(p => Math.max(p.advancers, p.decliners)), 1);
  const mid = height / 2;
  const barW = (width - padding * 2) / clean.length;
  const scale = (mid - padding) / maxVal;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="overflow-visible">
      <line x1={padding} y1={mid} x2={width - padding} y2={mid} stroke="#3f3f46" strokeWidth={1} />
      {clean.map((p, i) => {
        const x = padding + i * barW;
        const advH = p.advancers * scale;
        const decH = p.decliners * scale;
        return (
          <g key={p.date}>
            <rect x={x + 0.5} y={mid - advH} width={Math.max(barW - 1, 0.5)} height={advH} fill="#34d399" fillOpacity={0.85} />
            <rect x={x + 0.5} y={mid} width={Math.max(barW - 1, 0.5)} height={decH} fill="#f87171" fillOpacity={0.85} />
          </g>
        );
      })}
    </svg>
  );
}
