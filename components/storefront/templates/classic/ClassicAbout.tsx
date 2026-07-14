import type { ShopSite } from '@/components/storefront/types';

export default function ClassicAbout({ shop, isLight }: { shop: ShopSite['shop']; isLight?: boolean }) {
  if (!shop.aboutText) return null;
  return (
    <section className={`px-6 py-6 ${isLight ? 'text-zinc-700' : 'text-zinc-400'}`}>
      <h2 className="text-lg font-semibold mb-3" style={{ color: shop.themePrimaryHex }}>About</h2>
      <p className="leading-relaxed whitespace-pre-line">{shop.aboutText}</p>
    </section>
  );
}
