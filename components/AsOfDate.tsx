'use client';

/** Consistent "data as of" label — every Market page's derived data
 * (signals, predictions, index, movers, etc.) is computed once/day by the
 * cron, not live, so it can legitimately lag behind "today" by a day or
 * more if a run fails partway through. Surfacing the real date here beats
 * letting a page imply everything is current when it might not be. */
export default function AsOfDate({ date, label = 'Data as of' }: { date: string | null | undefined; label?: string }) {
  if (!date) {
    return <p className="text-xs text-zinc-600">No data yet.</p>;
  }
  const formatted = new Date(date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const isStale = (Date.now() - new Date(date + 'T00:00:00Z').getTime()) > 36 * 3600 * 1000;
  return (
    <p className={`text-xs ${isStale ? 'text-amber-500' : 'text-zinc-600'}`}>
      {label} {formatted}{isStale ? ' — more than a day old' : ''}
    </p>
  );
}
