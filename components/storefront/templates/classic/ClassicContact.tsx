import type { ShopSite } from '@/components/storefront/types';

export default function ClassicContact({ shop }: { shop: ShopSite['shop'] }) {
 return (
 <section className="px-6 py-8 max-w-3xl mx-auto">
 <h2 className="text-lg font-semibold text-zinc-100 mb-3">Contact</h2>
 <div className="space-y-2 text-sm text-zinc-400">
 {shop.address && <p>📍 {shop.address}</p>}
 {shop.phone && <p>📞 <a href={`tel:${shop.phone}`} className="hover:text-zinc-200">{shop.phone}</a></p>}
 {shop.email && <p>✉️ <a href={`mailto:${shop.email}`} className="hover:text-zinc-200">{shop.email}</a></p>}
 </div>
 </section>
 );
}
