'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

interface NavSidebarProps {
  items: NavItem[];
  userName?: string;
  brandLabel?: string;
}

export default function NavSidebar({ items, userName, brandLabel = 'Grimoire' }: NavSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
  }

  const navContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-zinc-800">
        <span className="text-lg font-black text-amber-400">{brandLabel}</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item)
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-zinc-800 space-y-1">
        {userName && <p className="text-xs text-zinc-600 px-1 truncate">{userName}</p>}
        <LogoutButton className="block w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 transition-colors" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex md:flex-col w-52 shrink-0 border-r border-zinc-800 bg-zinc-950 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile — hamburger button + overlay drawer */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside className={`fixed top-0 left-0 z-50 h-full w-52 bg-zinc-950 border-r border-zinc-800 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {navContent}
        </aside>
      </div>
    </>
  );
}
