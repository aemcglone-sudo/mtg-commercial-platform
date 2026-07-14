'use client';

import { useEffect, useState } from 'react';
import EventCard, { type EventData } from './EventCard';

interface Props {
  lat: number;
  lng: number;
  radius: number;
}

function groupByDay(events: EventData[]): Array<{ label: string; events: EventData[] }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const weekend = new Date(today);
  // Find next Saturday
  const dayOfWeek = today.getDay();
  const daysToSaturday = (6 - dayOfWeek + 7) % 7;
  weekend.setDate(today.getDate() + daysToSaturday);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);

  const groups: Record<string, EventData[]> = {
    Today: [],
    'This Weekend': [],
    'Next Week': [],
    'Coming Up': [],
    'Recurring Events': [],
  };

  for (const event of events) {
    if (event.is_recurring && !event.specific_date) {
      groups['Recurring Events'].push(event);
      continue;
    }
    if (!event.specific_date) { groups['Coming Up'].push(event); continue; }

    const date = new Date(event.specific_date + 'T12:00:00');
    if (date < tomorrow) { groups['Today'].push(event); }
    else if (date < weekend) { groups['This Weekend'].push(event); }
    else if (date < nextWeek) { groups['Next Week'].push(event); }
    else { groups['Coming Up'].push(event); }
  }

  return Object.entries(groups)
    .filter(([, evts]) => evts.length > 0)
    .map(([label, evts]) => ({ label, events: evts }));
}

export default function EventList({ lat, lng, radius }: Props) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius), days_ahead: '30' });
    if (eventTypeFilter) params.set('event_type', eventTypeFilter);
    fetch(`/api/local-play/events?${params}`)
      .then(r => r.json())
      .then((data: { events?: EventData[]; error?: string }) => {
        if (data.error) setError(data.error);
        else setEvents(data.events ?? []);
      })
      .catch(() => setError('Failed to load events'))
      .finally(() => setLoading(false));
  }, [lat, lng, radius, eventTypeFilter]);

  const groups = groupByDay(events);

  const EVENT_TYPES = [
    { value: '', label: 'All' },
    { value: 'FNM', label: 'FNM' },
    { value: 'prerelease', label: 'Prerelease' },
    { value: 'commander_night', label: 'Commander' },
    { value: 'draft', label: 'Draft' },
    { value: 'tournament', label: 'Tournament' },
  ];

  return (
    <div className="px-4 space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {EVENT_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setEventTypeFilter(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              eventTypeFilter === t.value
                ? 'bg-amber-500 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-zinc-500 text-sm py-8 text-center">Looking for events…</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400 text-sm">No upcoming events found within {radius} miles.</p>
          <p className="text-zinc-600 text-xs mt-1">Events are synced daily from Wizards Event Locator and store websites.</p>
        </div>
      )}

      {!loading && groups.map(group => (
        <div key={group.label}>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{group.label}</h3>
          <div className="space-y-2">
            {group.events.map(event => (
              <EventCard key={event.id} event={event} showStore={true} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
