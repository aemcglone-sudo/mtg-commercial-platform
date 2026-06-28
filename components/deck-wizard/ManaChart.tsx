'use client';

interface Props {
  cards: Array<{ cmc?: number; quantity?: number }>;
}

export function ManaChart({ cards }: Props) {
  const counts: number[] = [0, 0, 0, 0, 0, 0, 0]; // 0-5, 6+
  for (const card of cards) {
    const cmc = card.cmc ?? 0;
    const qty = card.quantity ?? 1;
    const bucket = Math.min(Math.floor(cmc), 6);
    counts[bucket] += qty;
  }

  const max = Math.max(...counts, 1);
  const labels = ['0', '1', '2', '3', '4', '5', '6+'];
  const colors = ['#71717a','#a78bfa','#60a5fa','#34d399','#fbbf24','#f97316','#f87171'];

  return (
    <div>
      <div className="flex items-end gap-1 h-16">
        {counts.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            {count > 0 && <span className="text-[9px] text-zinc-500">{count}</span>}
            <div
              className="w-full rounded-t transition-all duration-300"
              style={{ height: `${(count / max) * 48}px`, backgroundColor: colors[i], minHeight: count > 0 ? 4 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {labels.map((l, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-zinc-600">{l}</div>
        ))}
      </div>
    </div>
  );
}
