'use client';

interface Series {
  label: string;
  color: string;
  points: { date: string; value: number | null }[];
}

/** Two-line comparison chart, each series normalized to its own first
 * value = 100 — "which one grew faster" rather than absolute dollars.
 * Built specifically for Portfolio vs. Market Index; not a generic
 * multi-series component. */
export default function ComparisonChart({ series, height = 220 }: { series: Series[]; height?: number }) {
  const normalized = series.map(s => {
    const clean = s.points.filter((p): p is { date: string; value: number } => p.value !== null);
    const base = clean[0]?.value;
    const points = base && base > 0 ? clean.map(p => ({ date: p.date, value: (p.value / base) * 100 })) : [];
    return { ...s, points };
  }).filter(s => s.points.length >= 2);

  if (normalized.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-zinc-600 border border-zinc-800 rounded-lg" style={{ height }}>
        Not enough history yet to compare.
      </div>
    );
  }

  const width = 600;
  const marginLeft = 44;
  const marginRight = 8;
  const marginTop = 16;
  const marginBottom = 22;
  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;

  const allValues = normalized.flatMap(s => s.points.map(p => p.value));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const maxLen = Math.max(...normalized.map(s => s.points.length));
  const stepX = maxLen > 1 ? plotW / (maxLen - 1) : 0;

  const coordsFor = (points: { date: string; value: number }[]) =>
    points.map((p, i) => ({
      x: marginLeft + i * stepX,
      y: marginTop + plotH * (1 - (p.value - min) / range),
      value: p.value, date: p.date,
    }));

  const yTicks = [min, min + range / 2, max];
  const xTickCount = Math.min(4, maxLen);
  const longestSeries = normalized.reduce((a, b) => (b.points.length > a.points.length ? b : a));
  const xTickIdxs = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? 0 : Math.round((i * (longestSeries.points.length - 1)) / (xTickCount - 1))
  );
  const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="overflow-visible">
        {yTicks.map((v, i) => {
          const y = marginTop + plotH * (1 - (v - min) / range);
          return (
            <g key={i}>
              <line x1={marginLeft} y1={y} x2={width - marginRight} y2={y} stroke="#27272a" strokeWidth={1} />
              <text x={marginLeft - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#71717a">{v.toFixed(0)}</text>
            </g>
          );
        })}

        {xTickIdxs.map(i => (
          <text key={i} x={marginLeft + i * stepX} y={height - 4} textAnchor="middle" fontSize={10} fill="#71717a">
            {longestSeries.points[i] ? fmtDate(longestSeries.points[i].date) : ''}
          </text>
        ))}

        {normalized.map(s => {
          const coords = coordsFor(s.points);
          const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
          return (
            <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-2">
        {normalized.map(s => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
