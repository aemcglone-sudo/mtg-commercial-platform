'use client';

import Link from 'next/link';

export interface EventData {
  id: string;
  title: string;
  event_type: string;
  format: string | null;
  is_recurring: boolean;
  day_of_week: string | null;
  time_of_day: string | null;
  specific_date: string | null;
  entry_fee: string | null;
  notes: string | null;
  external_url: string | null;
  source: string;
  scrape_confidence: number | null;
  store_name?: string;
  store_address?: string | null;
  store_city?: string | null;
  store_id?: string;
  grimoire_shop_id?: string | null;
  distance_miles?: number;
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  FNM: '🌙',
  prerelease: '✨',
  commander_night: '👑',
  draft: '📦',
  sealed: '🎁',
  tournament: '🏆',
  casual: '🎲',
  store_championship: '🏅',
  other: '🎲',
};

function formatDay(event: EventData): string {
  if (event.specific_date) {
    const d = new Date(event.specific_date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (event.day_of_week) return `Every ${event.day_of_week}`;
  return '';
}

interface Props {
  event: EventData;
  showStore?: boolean;
}

export default function EventCard({ event, showStore = true }: Props) {
  const icon = EVENT_TYPE_ICONS[event.event_type] ?? '🎲';
  const dayStr = formatDay(event);
  const isTavilyUnverified = event.source === 'tavily_scrape' && (event.scrape_confidence ?? 1) < 0.9;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-zinc-100 text-sm leading-snug">{event.title}</h3>
            {event.distance_miles != null && (
              <span className="text-xs text-zinc-500 shrink-0">{event.distance_miles.toFixed(1)} mi</span>
            )}
          </div>

          {showStore && event.store_name && (
            <p className="text-xs text-zinc-400 mt-0.5">{event.store_name}</p>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-zinc-500">
            {event.format && <span className="text-zinc-300">{event.format}</span>}
            {dayStr && <span>{dayStr}</span>}
            {event.time_of_day && <span>{event.time_of_day}</span>}
            {event.entry_fee && <span className="text-zinc-400">{event.entry_fee}</span>}
          </div>

          {event.notes && (
            <p className="text-xs text-zinc-600 mt-1">{event.notes}</p>
          )}

          {isTavilyUnverified && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠ From store website — verify before attending
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        {event.store_id && (
          <Link
            href={`https://maps.google.com/maps?q=${encodeURIComponent([event.store_name, event.store_city].filter(Boolean).join(' '))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            Get Directions
          </Link>
        )}
        {event.external_url && (
          <a
            href={event.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 transition-colors"
          >
            Details ↗
          </a>
        )}
        {event.grimoire_shop_id && (
          <Link
            href={`/marketplace/find?shopId=${event.grimoire_shop_id}`}
            className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/20 transition-colors ml-auto"
          >
            Find Deck Cards Here
          </Link>
        )}
      </div>
    </div>
  );
}
