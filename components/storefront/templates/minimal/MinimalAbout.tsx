import type { ShopSite } from '@/components/storefront/types';

export default function MinimalAbout({ shop }: { shop: ShopSite['shop'] }) {
  if (!shop.aboutText) return null;
  return (
    <section className="max-w-3xl mx-auto px-6 py-10 border-b border-zinc-100">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">About</h2>
      <p className="text-zinc-700 leading-relaxed text-base">{shop.aboutText}</p>
      {shop.specialties.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5">
          {shop.specialties.map(s => (
            <span key={s} className="text-xs px-3 py-1 rounded-full border border-zinc-200 text-zinc-600">{s}</span>
          ))}
        </div>
      )}
    </section>
  );
}
