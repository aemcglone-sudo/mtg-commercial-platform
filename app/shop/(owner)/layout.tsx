'use client';

import NavSidebar from '@/components/NavSidebar';

const NAV = [
  { href: '/shop/dashboard',              label: 'Dashboard', exact: true },
  { href: '/shop/inventory',              label: 'Inventory' },
  { href: '/shop/collection?tab=collection', label: 'My Collection' },
  { href: '/shop/collection?tab=insights',   label: 'Insights' },
  { href: '/shop/collection?tab=mydecks',    label: 'My Decks & Lists' },
  { href: '/shop/collection?tab=decks',      label: 'Top Decks' },
  { href: '/shop/collection?tab=news',       label: 'News' },
  { href: '/shop/collection?tab=chat',       label: 'Ask Khoa', dividerAfter: true },
  { href: '/shop/settings',              label: 'Settings' },
];

export default function ShopOwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <NavSidebar items={NAV} brandLabel="Grimoire Shop" />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
