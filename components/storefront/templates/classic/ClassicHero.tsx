import type { ShopSite } from '@/components/storefront/types';

export default function ClassicHero({ shop }: { shop: ShopSite['shop'] }) {
  return (
    <div className="relative w-full">
      <div
        className="relative w-full h-56 sm:h-72 flex items-end"
        style={{
          background: shop.bannerUrl
            ? `url(${shop.bannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${shop.themePrimaryHex} 0%, ${shop.themeAccentHex}33 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="relative px-6 pb-6 flex items-end gap-4">
          {shop.logoUrl && (
            <img src={shop.logoUrl} alt={shop.name} className="w-16 h-16 rounded-xl object-contain bg-white/10 backdrop-blur-sm p-1 shrink-0" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow">{shop.name}</h1>
            {shop.address && <p className="text-sm text-white/70 mt-0.5">{shop.address}</p>}
          </div>
        </div>
      </div>
      {/* Always-visible brand stripe */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${shop.themePrimaryHex} 0%, ${shop.themeAccentHex} 100%)` }} />
    </div>
  );
}
