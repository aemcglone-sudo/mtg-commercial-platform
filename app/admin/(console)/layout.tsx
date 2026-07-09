'use client';

import NavSidebar from '@/components/NavSidebar';

const NAV = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/shops', label: 'Shops' },
  { href: '/admin/mtg-rules', label: 'MTG Rules' },
  { href: '/admin/deck-rules', label: 'Deck Rules' },
  { href: '/admin/deck-feedback', label: 'Deck Feedback' },
  { href: '/admin/deck-log', label: 'Deck Log' },
  { href: '/admin/store-claims', label: 'Store Claims' },
  { href: '/admin/product', label: 'Product' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <NavSidebar items={NAV} brandLabel="Grimoire Admin" />
      <main className="flex-1 min-w-0 px-8 py-8">
        {children}
      </main>
    </div>
  );
}
