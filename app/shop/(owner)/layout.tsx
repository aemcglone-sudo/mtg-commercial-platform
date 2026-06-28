'use client';

import NavSidebar from '@/components/NavSidebar';

const NAV = [
  { href: '/shop/dashboard',                  label: 'Dashboard', exact: true },
  { href: '/shop/orders',                     label: 'Orders' },
  { href: '/shop/campaigns',                  label: 'Campaigns' },
  { label: 'Pricing', children: [
      { href: '/shop/pricing?tab=sale',     label: 'Sale Pricing' },
      { href: '/shop/pricing?tab=purchase', label: 'Purchase Pricing' },
  ]},
  { href: '/shop/collection?tab=inventory',   label: 'Inventory' },
  { href: '/shop/collection?tab=chat',        label: 'Ask Khoa', dividerAfter: true },
  { href: '/shop/settings',                   label: 'Settings' },
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
