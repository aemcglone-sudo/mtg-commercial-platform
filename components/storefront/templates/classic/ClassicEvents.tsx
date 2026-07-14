import type { ShopSite } from '@/components/storefront/types';

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

export default function ClassicEvents({ events, isLight, shop }: { events: ShopSite['events']; isLight?: boolean; shop: ShopSite['shop'] }) {
  if (events.length === 0) return null;
  return (
    <section className="px-6 py-6">
      <h2 className="text-lg font-semibold mb-4" style={{ color: shop.themePrimaryHex }}>Upcoming Events</h2>
      <div className="space-y-3">
        {events.map(e => {
          const date = new Date(e.startsAt);
          return (
            <div key={e.id} className={`border rounded-xl px-4 py-3 flex gap-4 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className="shrink-0 text-center w-12">
                <p className="text-xs uppercase text-zinc-500">{date.toLocaleDateString('en-US', { month: 'short' })}</p>
                <p className={`text-2xl font-bold leading-none ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{date.getDate()}</p>
              </div>
              <div>
                <p className={`font-medium text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{e.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {e.eventType && <p className="text-xs font-medium" style={{ color: shop.themeAccentHex }}>{e.eventType}</p>}
                  {e.isRecurring && (
                    <span className={`text-xs ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      · {RECURRENCE_LABELS[e.recurrenceRule ?? ''] ?? 'Recurring'}
                    </span>
                  )}
                </div>
                {e.description && <p className={`text-xs mt-1 line-clamp-2 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>{e.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
