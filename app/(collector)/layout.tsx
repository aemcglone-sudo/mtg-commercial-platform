'use client';

import NavSidebar from '@/components/NavSidebar';

const NAV = [
  { href: '/', label: 'My Collection', exact: true },
  { href: '/settings', label: 'Settings' },
];

export default function CollectorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <NavSidebar items={NAV} />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
