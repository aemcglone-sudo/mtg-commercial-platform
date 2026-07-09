'use client';

import Link from 'next/link';

const CATEGORY_EMOJI: Record<string, string> = {
  booster_box:          '📦',
  booster_pack:         '🃏',
  collector_box:        '✨',
  bundle:               '🎁',
  commander_precon:     '⚔️',
  commander_collection: '👑',
  prerelease_kit:       '🎉',
  starter_deck:         '🌱',
  jumpstart:            '⚡',
  secret_lair:          '🔮',
  anthology:            '📖',
  sleeve:               '🛡️',
  deck_box:             '🗄️',
  playmat:              '🖼️',
  dice:                 '🎲',
  binder:               '📚',
  storage_box:          '🗃️',
  tokens:               '🪙',
  other_sealed:         '📦',
  other_accessory:      '🔧',
};

interface ProductCardProps {
  id: string;
  name: string;
  category: string;
  set_code?: string | null;
  set_name?: string | null;
  msrp_cents?: number | null;
  image_url?: string | null;
  nearby_count?: number;
  shop_names?: string | null;
}

export default function ProductCard({ id, name, category, set_code, set_name, msrp_cents, image_url, nearby_count, shop_names }: ProductCardProps) {
  const emoji = CATEGORY_EMOJI[category] ?? '📦';
  const isNearby = (nearby_count ?? 0) > 0;
  const setIconUrl = set_code
    ? `https://svgs.scryfall.io/sets/${set_code.toLowerCase()}.svg`
    : null;

  return (
    <Link
      href={`/products/${id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-colors group"
    >
      <div className="aspect-square bg-zinc-800 flex flex-col items-center justify-center relative gap-2">
        {image_url ? (
          <img src={image_url} alt={name} className="w-full h-full object-contain p-2" />
        ) : (
          <>
            <span className="text-5xl">{emoji}</span>
            {setIconUrl && (
              <img
                src={setIconUrl}
                alt={set_name ?? ''}
                className="w-8 h-8 opacity-25 invert"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </>
        )}
        {isNearby && (
          <span className="absolute top-2 right-2 bg-green-800 text-green-300 text-xs px-1.5 py-0.5 rounded-full font-medium">
            Nearby
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2 group-hover:text-white">{name}</p>
        <p className="text-xs text-zinc-500 mt-1">{set_name ?? category.replace(/_/g, ' ')}</p>
        {msrp_cents && (
          <p className="text-xs text-zinc-400 mt-1">MSRP ${(msrp_cents / 100).toFixed(2)}</p>
        )}
        {shop_names && (
          <p className="text-xs text-emerald-500 mt-1 truncate">{shop_names}</p>
        )}
      </div>
    </Link>
  );
}
