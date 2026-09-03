'use client';

/** Minimal dependency-free SVG line chart for price history. Not a generic
 * charting component — built specifically for the Market feature's small,
 * single-series price-over-time use case. */
export default function PriceChart({ points, height = 160 }: { points: { date: string; value: number | null }[]; height?: number }) {
  const clean = points.filter((p): p is { date: string; value: number } => p.value !== null);

  if (clean.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-zinc-600 border border-zinc-800 rounded-lg" style={{ height }}>
        Not enough price history yet — check back after a few daily snapshots.
      </div>
    );
  }

  const width = 600;
  const padding = 8;
  const values = clean.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = (width - padding * 2) / (clean.length - 1);
  const coords = clean.map((p, i) => {
    const x = padding + i * stepX;
    const y = padding + (height - padding * 2) * (1 - (p.value - min) / range);
    return { x, y, value: p.value, date: p.date };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const first = clean[0].value;
  const last = clean[clean.length - 1].value;
  const up = last >= first;
  const stroke = up ? '#34d399' : '#f87171';
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padding} L ${coords[0].x.toFixed(1)} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="overflow-visible">
      <path d={areaD} fill={stroke} fillOpacity={0.08} stroke="none" />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 3 : 0} fill={stroke} />
      ))}
    </svg>
  );
}
