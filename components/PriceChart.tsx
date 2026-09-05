'use client';

/** Minimal dependency-free SVG line chart for price/value-over-time series.
 * Not a generic charting component — built specifically for the Market
 * feature's small, single-series use case. Always renders a value axis
 * (left) and a date axis (bottom) — `formatValue` lets callers change the
 * unit shown (dollars by default; the Market Index page passes an
 * index-point formatter instead). */
export default function PriceChart({
  points, height = 160, formatValue = (v: number) => `$${v.toFixed(2)}`, unitLabel,
}: {
  points: { date: string; value: number | null }[];
  height?: number;
  formatValue?: (v: number) => string;
  /** Shown once, top-left — for when the tick format alone doesn't make
   * the unit obvious (e.g. plain index-point numbers). Dollar charts don't
   * need this since every tick already reads "$1.70". */
  unitLabel?: string;
}) {
  const clean = points.filter((p): p is { date: string; value: number } => p.value !== null);

  if (clean.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-zinc-600 border border-zinc-800 rounded-lg" style={{ height }}>
        Not enough price history yet — check back after a few daily snapshots.
      </div>
    );
  }

  const width = 600;
  const marginLeft = 52;
  const marginRight = 8;
  const marginTop = 16;
  const marginBottom = 22;
  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;

  const values = clean.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = clean.length > 1 ? plotW / (clean.length - 1) : 0;
  const coords = clean.map((p, i) => {
    const x = marginLeft + i * stepX;
    const y = marginTop + plotH * (1 - (p.value - min) / range);
    return { x, y, value: p.value, date: p.date };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const first = clean[0].value;
  const last = clean[clean.length - 1].value;
  const up = last >= first;
  const stroke = up ? '#34d399' : '#f87171';
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${marginTop + plotH} L ${coords[0].x.toFixed(1)} ${marginTop + plotH} Z`;

  // Y-axis: 3 ticks (min, mid, max).
  const yTicks = [min, min + range / 2, max];

  // X-axis: up to 4 evenly-spaced date labels (first, ..., last).
  const xTickCount = Math.min(4, clean.length);
  const xTickIdxs = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? 0 : Math.round((i * (clean.length - 1)) / (xTickCount - 1))
  );
  const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="overflow-visible">
      {unitLabel && (
        <text x={marginLeft} y={marginTop - 2} textAnchor="start" fontSize={9} fill="#52525b">{unitLabel}</text>
      )}
      {/* Y-axis gridlines + labels */}
      {yTicks.map((v, i) => {
        const y = marginTop + plotH * (1 - (v - min) / range);
        return (
          <g key={i}>
            <line x1={marginLeft} y1={y} x2={width - marginRight} y2={y} stroke="#27272a" strokeWidth={1} />
            <text x={marginLeft - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#71717a">
              {formatValue(v)}
            </text>
          </g>
        );
      })}

      {/* X-axis date labels */}
      {xTickIdxs.map(i => (
        <text key={i} x={coords[i].x} y={height - 4} textAnchor="middle" fontSize={10} fill="#71717a">
          {fmtDate(clean[i].date)}
        </text>
      ))}

      <path d={areaD} fill={stroke} fillOpacity={0.08} stroke="none" />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 3 : 0} fill={stroke} />
      ))}
    </svg>
  );
}
