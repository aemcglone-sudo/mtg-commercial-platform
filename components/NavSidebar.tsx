'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
  dividerAfter?: boolean;
}

interface NavSidebarProps {
  items: NavItem[];
  userName?: string;
  brandLabel?: string;
}

function NavContent({ items, userName, brandLabel, onNavigate }: NavSidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isActive(item: NavItem) {
    const [path, query] = item.href.split('?');
    if (pathname !== path) return false;
    if (!query) {
      // No query in href — active only if page also has no tab param (or exact match)
      return item.exact ? !searchParams.get('tab') : true;
    }
    const param = new URLSearchParams(query);
    const tab = param.get('tab');
    return tab ? searchParams.get('tab') === tab : true;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-zinc-800">
        <span className="text-lg font-black text-amber-400">{brandLabel ?? 'Grimoire'}</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item, i) => (
          <div key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item)
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {item.label}
            </Link>
            {item.dividerAfter && i < items.length - 1 && (
              <div className="my-2 border-t border-zinc-800" />
            )}
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-zinc-800 space-y-1">
        {userName && <p className="text-xs text-zinc-600 px-1 truncate">{userName}</p>}
        <LogoutButton className="block w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 transition-colors" />
      </div>
    </div>
  );
}

export default function NavSidebar(props: NavSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex md:flex-col w-52 shrink-0 border-r border-zinc-800 bg-zinc-950 h-screen sticky top-0">
        <Suspense>
          <NavContent {...props} />
        </Suspense>
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

        {open && (
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)} />
        )}

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
          <Suspense>
            <NavContent {...props} onNavigate={() => setOpen(false)} />
          </Suspense>
        </aside>
      </div>
    </>
  );
}
