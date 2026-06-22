'use client';

import { buildTCGPlayerUrl, type TCGPlayerCard } from '@/lib/tcgplayer';

interface Props {
  cards: TCGPlayerCard[];
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function BuyOnTCGPlayer({ cards, label, size = 'md', className = '' }: Props) {
  const valid = cards.filter(c => c.name?.trim() && c.quantity > 0);
  if (valid.length === 0) return null;

  function handleClick() {
    window.open(buildTCGPlayerUrl(valid), '_blank', 'noopener,noreferrer');
  }

  const defaultLabel = label ?? `🛒 Buy ${valid.length} card${valid.length !== 1 ? 's' : ''} on TCGPlayer`;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors ${
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-6 py-3 text-sm w-full'
      } ${className}`}
    >
      {defaultLabel}
    </button>
  );
}
