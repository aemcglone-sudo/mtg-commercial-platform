import type { ShopSite } from '@/components/storefront/types';

export default function MinimalHero({ shop }: { shop: ShopSite['shop'] }) {
  return (
    <div className="w-full border-b border-zinc-200">
      {/* Accent stripe */}
      <div className="h-1 w-full" style={{ background: shop.themePrimaryHex }} />
      <div className="max-w-3xl mx-auto px-6 py-10 flex items-center gap-5">
        {shop.logoUrl && (
          <img src={shop.logoUrl} alt={shop.name}
            className="w-14 h-14 rounded-lg object-contain border border-zinc-200 shrink-0" />
        )}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{shop.name}</h1>
          {shop.address && <p className="text-sm text-zinc-500 mt-1">{shop.address}</p>}
          {(shop.phone || shop.email) && (
            <p className="text-sm text-zinc-500 mt-0.5">
              {[shop.phone, shop.email].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
