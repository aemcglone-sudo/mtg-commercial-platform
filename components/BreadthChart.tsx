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
  const marginLeft = 40;
  const marginRight = 8;
  const marginTop = 14;
  const marginBottom = 22;
  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;
  const halfPlotH = plotH / 2;
  const mid = marginTop + halfPlotH;

  const maxVal = Math.max(...clean.map(p => Math.max(p.advancers, p.decliners)), 1);
  const barW = plotW / clean.length;
  const scale = halfPlotH / maxVal;

  const yTicks = [maxVal, Math.round(maxVal / 2), 0, -Math.round(maxVal / 2), -maxVal];

  const xTickCount = Math.min(4, clean.length);
  const xTickIdxs = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? 0 : Math.round((i * (clean.length - 1)) / (xTickCount - 1))
  );
  const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="overflow-visible">
      <text x={marginLeft} y={marginTop - 4} textAnchor="start" fontSize={9} fill="#52525b">Cards</text>
      {/* Y-axis labels — cards, mirrored above/below the zero line */}
      {yTicks.map((v, i) => {
        const y = mid - (v / maxVal) * halfPlotH;
        return (
          <g key={i}>
            <text x={marginLeft - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#71717a">
              {Math.abs(v)}
            </text>
          </g>
        );
      })}

      <line x1={marginLeft} y1={mid} x2={width - marginRight} y2={mid} stroke="#3f3f46" strokeWidth={1} />

      {clean.map((p, i) => {
        const x = marginLeft + i * barW;
        const advH = p.advancers * scale;
        const decH = p.decliners * scale;
        return (
          <g key={p.date}>
            <rect x={x + 0.5} y={mid - advH} width={Math.max(barW - 1, 0.5)} height={advH} fill="#34d399" fillOpacity={0.85} />
            <rect x={x + 0.5} y={mid} width={Math.max(barW - 1, 0.5)} height={decH} fill="#f87171" fillOpacity={0.85} />
          </g>
        );
      })}

      {/* X-axis date labels */}
      {xTickIdxs.map(i => (
        <text key={i} x={marginLeft + i * barW + barW / 2} y={height - 4} textAnchor="middle" fontSize={10} fill="#71717a">
          {fmtDate(clean[i].date)}
        </text>
      ))}
    </svg>
  );
}
