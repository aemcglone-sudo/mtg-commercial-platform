import type { ShopSite } from '@/components/storefront/types';

const DAY_LABELS: Record<string, string> = {
 mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday',
 fri:'Friday', sat:'Saturday', sun:'Sunday',
};

export default function ClassicHoursLocation({ shop, isLight }: { shop: ShopSite['shop']; isLight?: boolean }) {
 const hasHours = shop.hours && Object.keys(shop.hours).length > 0;
 const borderCls = isLight ?'bg-zinc-50 border-zinc-200':'bg-zinc-900/50 border-zinc-800';
 const headCls = isLight ?'text-zinc-900':'text-zinc-100';
 const textCls = isLight ?'text-zinc-600':'text-zinc-400';
 const mutedCls = isLight ?'text-zinc-500':'text-zinc-500';
 const hrCls = isLight ?'text-zinc-800':'text-zinc-300';

 return (
 <section className="px-6 py-6">
 <div className="max-w-5xl grid sm:grid-cols-2 gap-8">
 <div>
 <h2 className="text-lg font-semibold mb-3" style={{ color: shop.themePrimaryHex }}>Location & Contact</h2>
 <div className={`space-y-2 text-sm ${textCls}`}>
 {shop.address && <p>📍 {shop.address}</p>}
 {shop.phone && <p>📞 <a href={`tel:${shop.phone}`} className="hover:underline">{shop.phone}</a></p>}
 {shop.email && <p>✉️ <a href={`mailto:${shop.email}`} className="hover:underline">{shop.email}</a></p>}
 {shop.websiteUrl && (
 <p><a href={shop.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">
 🌐 {shop.websiteUrl.replace(/^https?:\/\//,'')}
 </a></p>
 )}
 </div>
 </div>
 {hasHours && (
 <div>
 <h2 className="text-lg font-semibold mb-3" style={{ color: shop.themePrimaryHex }}>Hours</h2>
 <div className="space-y-1">
 {Object.entries(DAY_LABELS).map(([key, label]) => {
 const val = shop.hours?.[key];
 if (!val) return null;
 return (
 <div key={key} className="flex justify-between text-sm">
 <span className={mutedCls}>{label}</span>
 <span className={hrCls}>{val}</span>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 </section>
 );
}
