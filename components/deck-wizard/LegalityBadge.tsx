'use client';

interface Props {
  legal: boolean | null;
  banned?: boolean;
  restricted?: boolean;
  reason?: string | null;
  source?: string | null;
  size?: 'sm' | 'md';
}

export function LegalityBadge({ legal, banned, restricted, reason, source, size = 'sm' }: Props) {
  if (legal === null) return null;

  const base = size === 'sm' ? 'px-1.5 py-0.5 text-[10px] rounded' : 'px-2 py-1 text-xs rounded-lg';

  if (banned) {
    return (
      <span title={`${reason ?? 'Banned'}${source ? ` — ${source}` : ''}`}
        className={`${base} font-semibold bg-red-900/60 text-red-300 border border-red-700`}>
        BANNED
      </span>
    );
  }
  if (restricted) {
    return (
      <span title={`Restricted — max 1 copy${reason ? ` (${reason})` : ''}`}
        className={`${base} font-semibold bg-amber-900/60 text-amber-300 border border-amber-700`}>
        RESTRICTED
      </span>
    );
  }
  if (!legal) {
    return (
      <span title={reason ?? 'Not legal in this format'}
        className={`${base} font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700`}>
        NOT LEGAL
      </span>
    );
  }
  return (
    <span className={`${base} font-semibold bg-green-900/40 text-green-400 border border-green-800`}>
      ✓ LEGAL
    </span>
  );
}
