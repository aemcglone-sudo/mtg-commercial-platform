'use client';

import Link from 'next/link';

interface Props {
  scryfallId: string;
  available: boolean;
  storeCount?: number;
  lowestPriceCents?: number;
  loading?: boolean;
}

export default function CardAvailabilityBadge({ scryfallId, available, storeCount, lowestPriceCents, loading }: Props) {
  if (loading) {
    return <span className="text-[10px] text-zinc-600 animate-pulse">checking local…</span>;
  }

  if (!available) {
    return <span className="text-[10px] text-zinc-600">● Not found locally</span>;
  }

  const price = lowestPriceCents ? ` · $${(lowestPriceCents / 100).toFixed(2)}` : '';
  const stores = storeCount === 1 ? '1 store' : `${storeCount} stores`;

  return (
    <Link
      href={`/marketplace/card/${scryfallId}`}
      className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
      onClick={e => e.stopPropagation()}
    >
      ● Available at {stores}{price}
    </Link>
  );
}
