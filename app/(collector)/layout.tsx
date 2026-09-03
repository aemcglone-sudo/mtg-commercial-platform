'use client';

import { useState, useEffect, useCallback } from 'react';
import NavSidebar from '@/components/NavSidebar';
import ComboToast from '@/components/ComboToast';
import ProductTour from '@/components/ProductTour';
import { findCombos, type Combo } from '@/lib/combo-finder';

const NAV = [
  { href: '/?tab=collection', label: 'My Collection', exact: true, tourId: 'nav-collection' },
  { href: '/?tab=insights',   label: 'Insights', tourId: 'nav-insights' },
  { href: '/?tab=mydecks',    label: 'My Decks & Lists', tourId: 'nav-mydecks' },
  { href: '/?tab=decks',      label: 'Top Decks', tourId: 'nav-decks' },
  { href: '/?tab=news',       label: 'News', tourId: 'nav-news' },
  { href: '/?tab=chat',       label: 'Ask Khoa', tourId: 'nav-chat' },
  { href: '/local-play',      label: 'Local Play', tourId: 'nav-local-play' },
  { href: '/simulator',       label: 'Commander Simulator' },
  { href: '/market',          label: 'Market' },
  { label: 'Shop', dividerAfter: true, tourId: 'nav-shop-group', children: [
    { href: '/stores',            label: 'Nearby Shops' },
    { href: '/marketplace/find',  label: 'Card Finder' },
    { href: '/products',          label: 'MTG Products' },
  ]},
  { href: '/settings',        label: 'Settings', tourId: 'nav-settings' },
];

const SEEN_KEY = 'grimoire_seen_combos';

function getSeenCombos(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveSeenCombos(combos: Combo[]) {
  const keys = combos.map(c => c.cards.slice().sort().join('|'));
  localStorage.setItem(SEEN_KEY, JSON.stringify(keys));
}

function comboKey(c: Combo) {
  return c.cards.slice().sort().join('|');
}

export default function CollectorLayout({ children }: { children: React.ReactNode }) {
  const [newCombos, setNewCombos] = useState<Combo[]>([]);

  const checkCombos = useCallback((cardNames: string[]) => {
    const found = findCombos(cardNames);
    const seen = getSeenCombos();
    const fresh = found.filter(c => !seen.has(comboKey(c)));
    saveSeenCombos(found); // mark all current combos as seen
    if (fresh.length > 0) setNewCombos(fresh);
  }, []);

  // Listen for collection updates dispatched after upload
  useEffect(() => {
    function handler(e: Event) {
      const cardNames = (e as CustomEvent<string[]>).detail;
      checkCombos(cardNames);
    }
    window.addEventListener('collection-updated', handler);
    return () => window.removeEventListener('collection-updated', handler);
  }, [checkCombos]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <NavSidebar items={NAV} />
      <main className="flex-1 min-w-0">
        {children}
      </main>
      {newCombos.length > 0 && (
        <ComboToast newCombos={newCombos} onDismiss={() => setNewCombos([])} />
      )}
      <ProductTour />
    </div>
  );
}
