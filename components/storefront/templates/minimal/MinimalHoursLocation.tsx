import type { ShopSite } from '@/components/storefront/types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MinimalHoursLocation({ shop }: { shop: ShopSite['shop'] }) {
  const hasHours = shop.hours && Object.keys(shop.hours).length > 0;

  return (
    <section className="max-w-3xl mx-auto px-6 py-10 border-b border-zinc-100">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-6">Hours & Location</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">

        {/* Hours */}
        {hasHours && (
          <div>
            <div className="space-y-1">
              {DAYS.map(day => {
                const val = shop.hours?.[day] ?? 'Closed';
                const isClosed = val.toLowerCase() === 'closed' || val === '';
                return (
                  <div key={day} className="flex justify-between text-sm">
                    <span className="text-zinc-500 w-28">{day}</span>
                    <span className={isClosed ? 'text-zinc-400' : 'text-zinc-900'}>{isClosed ? 'Closed' : val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="space-y-2 text-sm">
          {shop.address && <p className="text-zinc-700">{shop.address}</p>}
          {shop.phone && (
            <p>
              <a href={`tel:${shop.phone}`} className="text-zinc-700 hover:text-zinc-900 transition-colors">{shop.phone}</a>
            </p>
          )}
          {shop.email && (
            <p>
              <a href={`mailto:${shop.email}`} className="text-zinc-700 hover:text-zinc-900 transition-colors">{shop.email}</a>
            </p>
          )}
          {shop.websiteUrl && (
            <p>
              <a href={shop.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-700 hover:text-zinc-900 transition-colors underline-offset-2 underline">{shop.websiteUrl.replace(/^https?:\/\//, '')}</a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
