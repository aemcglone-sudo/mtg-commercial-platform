'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import NotificationBell from '@/components/marketplace/NotificationBell';

export interface NavItem {
  href?: string;
  label: string;
  exact?: boolean;
  dividerAfter?: boolean;
  children?: { href: string; label: string; exact?: boolean }[];
}

interface NavSidebarProps {
  items: NavItem[];
  userName?: string;
  brandLabel?: string;
}

function NavContent({ items, userName, brandLabel, onNavigate }: NavSidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isActive(href: string, exact?: boolean) {
    const [path, query] = href.split('?');
    if (pathname !== path) return false;
    if (!query) return exact ? !searchParams.get('tab') : true;
    const param = new URLSearchParams(query);
    const tab = param.get('tab');
    return tab ? searchParams.get('tab') === tab : true;
  }

  function groupActive(item: NavItem) {
    if (item.href) return isActive(item.href, item.exact);
    return item.children?.some(c => isActive(c.href, c.exact)) ?? false;
  }

  // Track which groups are open — start open if a child is active
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const item of items) {
      if (item.children) {
        init[item.label] = item.children.some(c => {
          const [path, query] = c.href.split('?');
          if (typeof window === 'undefined') return false;
          if (pathname !== path) return false;
          if (!query) return true;
          return true;
        });
      }
    }
    return init;
  });

  function toggleGroup(label: string) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-zinc-800">
        <span className="text-lg font-black text-amber-400">{brandLabel ?? 'Grimoire'}</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item, i) => {
          const active = groupActive(item);
          const isGroup = !!item.children;
          const expanded = openGroups[item.label];

          return (
            <div key={item.label}>
              {isGroup ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.label)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <span>{item.label}</span>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expanded && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-zinc-800 space-y-0.5">
                      {item.children!.map(child => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive(child.href, child.exact)
                              ? 'text-zinc-100 bg-zinc-800'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href!}
                  onClick={onNavigate}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  {item.label}
                </Link>
              )}
              {item.dividerAfter && i < items.length - 1 && (
                <div className="my-2 border-t border-zinc-800" />
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-zinc-800 space-y-1">
        <div className="flex items-center justify-between px-1 mb-1">
          {userName && <p className="text-xs text-zinc-600 truncate">{userName}</p>}
          <NotificationBell />
        </div>
        <LogoutButton className="block w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 transition-colors" />
      </div>
    </div>
  );
}

export default function NavSidebar(props: NavSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-52 shrink-0 border-r border-zinc-800 bg-zinc-950 h-screen sticky top-0">
        <Suspense>
          <NavContent {...props} />
        </Suspense>
      </aside>

      {/* Mobile hamburger + drawer */}
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

        {open && <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)} />}

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
