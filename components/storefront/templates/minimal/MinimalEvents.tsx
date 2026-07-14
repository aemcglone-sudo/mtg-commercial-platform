import type { ShopSite } from '@/components/storefront/types';

export default function MinimalEvents({ events }: { events: ShopSite['events'] }) {
  if (!events.length) return null;

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), date: d.getDate(), month: d.toLocaleDateString('en-US', { month: 'short' }), time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) };
  }

  return (
    <section className="max-w-3xl mx-auto px-6 py-10 border-b border-zinc-100">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-6">Events</h2>
      <div className="space-y-4">
        {events.map(e => {
          const { day, date, month, time } = fmtDate(e.startsAt);
          return (
            <div key={e.id} className="flex gap-5 items-start">
              {/* Date badge */}
              <div className="shrink-0 text-center w-12">
                <p className="text-xs text-zinc-400 uppercase">{day}</p>
                <p className="text-2xl font-bold text-zinc-900 leading-none">{date}</p>
                <p className="text-xs text-zinc-400 uppercase">{month}</p>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-medium text-zinc-900">{e.title}</p>
                {e.eventType && <p className="text-xs text-zinc-400 mt-0.5">{e.eventType} · {time}</p>}
                {e.description && <p className="text-sm text-zinc-600 mt-1 leading-relaxed">{e.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
