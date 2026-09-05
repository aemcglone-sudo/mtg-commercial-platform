'use client';

/** Tiny inline trend line — no axes/labels, just the shape of the move.
 * Used in dense list rows (Set Movers) where a full PriceChart would be
 * too heavy visually and too expensive to fetch per-row. */
export default function Sparkline({ values, positive, width = 64, height = 24 }: { values: number[]; positive: boolean; width?: number; height?: number }) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="shrink-0" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#34d399' : '#f87171'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
