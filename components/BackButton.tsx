'use client';

import { useRouter } from 'next/navigation';

/** Goes back to wherever the user actually came from (Scoreboard, Movers,
 * a search, etc.) instead of always dropping them on the generic /market
 * landing page — a static "Back to Market" link loses that context every
 * time you drill into a card or set from somewhere other than /market
 * itself. Falls back to fallbackHref when there's no in-app history to
 * return to (a fresh tab, a direct link, a page refresh). */
export default function BackButton({ fallbackHref, label = '← Back' }: { fallbackHref: string; label?: string }) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button type="button" onClick={handleClick} className="text-xs text-zinc-500 hover:text-zinc-300">
      {label}
    </button>
  );
}
