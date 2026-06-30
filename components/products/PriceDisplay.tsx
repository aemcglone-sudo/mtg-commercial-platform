'use client';

interface PriceDisplayProps {
  priceCents: number;
  msrpCents?: number | null;
}

export default function PriceDisplay({ priceCents, msrpCents }: PriceDisplayProps) {
  const price = `$${(priceCents / 100).toFixed(2)}`;

  if (!msrpCents) {
    return <span className="font-semibold text-zinc-100">{price}</span>;
  }

  const diff = priceCents - msrpCents;
  const savingsPct = Math.round(((msrpCents - priceCents) / msrpCents) * 100);

  if (diff < 0) {
    return (
      <span className="flex items-baseline gap-1.5">
        <span className="font-semibold text-green-400">{price}</span>
        <span className="text-xs text-green-600">{savingsPct}% off MSRP</span>
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="flex items-baseline gap-1.5">
        <span className="font-semibold text-amber-400">{price}</span>
        <span className="text-xs text-amber-600">Above MSRP</span>
      </span>
    );
  }
  return <span className="font-semibold text-zinc-100">{price}</span>;
}
