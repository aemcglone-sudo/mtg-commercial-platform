'use client';

import { useState, useEffect, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import NotificationBell from '@/components/marketplace/NotificationBell';
import UserAvatarMenu from '@/components/UserAvatarMenu';
import { DotIcon } from '@/components/nav-icons';

export interface NavItem {
  href?: string;
  label: string;
  exact?: boolean;
  dividerAfter?: boolean;
  tourId?: string;
  icon?: ReactNode;
  children?: { href: string; label: string; exact?: boolean; tourId?: string }[];
}

interface NavSidebarProps {
  items: NavItem[];
  brandLabel?: string;
}

const COLLAPSE_KEY = 'grimoire_nav_collapsed';

function NavContent({ items, brandLabel, onNavigate, collapsed }: NavSidebarProps & { onNavigate?: () => void; collapsed?: boolean }) {
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

  // Which group's flyout is open, when collapsed (icon-only groups can't expand inline).
  const [flyout, setFlyout] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className={`border-b border-zinc-800 flex items-center ${collapsed ? 'px-0 py-5 justify-center' : 'px-5 py-5'}`}>
        {collapsed ? (
          <span className="text-lg font-black text-amber-400">{(brandLabel ?? 'Grimoire')[0]}</span>
        ) : (
          <span className="text-lg font-black text-amber-400">{brandLabel ?? 'Grimoire'}</span>
        )}
      </div>

      <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-visible min-h-0 ${collapsed ? 'px-2' : 'px-3'}`}>
        {items.map((item, i) => {
          const active = groupActive(item);
          const isGroup = !!item.children;
          const expanded = openGroups[item.label];
          const icon = item.icon ?? <DotIcon />;

          return (
            <div key={item.label} className="relative">
              {isGroup ? (
                <>
                  <button
                    type="button"
                    data-tour={item.tourId}
                    title={collapsed ? item.label : undefined}
                    onClick={() => collapsed ? setFlyout(f => f === item.label ? null : item.label) : toggleGroup(item.label)}
                    className={`w-full flex items-center rounded-lg text-sm font-medium transition-colors ${
                      collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                    } ${active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
                  >
                    {collapsed ? (
                      <span className="w-5 h-5 shrink-0">{icon}</span>
                    ) : (
                      <>
                        <span className="flex items-center gap-2.5">
                          <span className="w-4 h-4 shrink-0">{icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>

                  {!collapsed && expanded && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-zinc-800 space-y-0.5">
                      {item.children!.map(child => (
                        <Link
                          key={child.href}
                          href={child.href}
                          data-tour={child.tourId}
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

                  {collapsed && flyout === item.label && (
                    <div className="absolute left-full top-0 ml-2 z-50 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1.5">
                      <p className="px-3 py-1 text-xs font-semibold text-zinc-500">{item.label}</p>
                      {item.children!.map(child => (
                        <Link
                          key={child.href}
                          href={child.href}
                          data-tour={child.tourId}
                          onClick={() => { setFlyout(null); onNavigate?.(); }}
                          className={`block px-3 py-2 text-sm transition-colors ${
                            isActive(child.href, child.exact)
                              ? 'text-zinc-100 bg-zinc-800'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
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
                  data-tour={item.tourId}
                  title={collapsed ? item.label : undefined}
                  onClick={onNavigate}
                  className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                    collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5'
                  } ${active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
                >
                  <span className={collapsed ? 'w-5 h-5 shrink-0' : 'w-4 h-4 shrink-0'}>{icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )}
              {item.dividerAfter && i < items.length - 1 && (
                <div className="my-2 border-t border-zinc-800" />
              )}
            </div>
          );
        })}
      </nav>

      <div className={`border-t border-zinc-800 ${collapsed ? 'px-2 py-3' : 'px-4 py-4'}`} data-tour="avatar-menu">
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
          <UserAvatarMenu />
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}

export default function NavSidebar(props: NavSidebarProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex md:flex-col shrink-0 border-r border-zinc-800 bg-zinc-950 h-screen sticky top-0 transition-[width] duration-150 relative ${
        hydrated && collapsed ? 'w-16' : 'w-52'
      }`}>
        <Suspense>
          <NavContent {...props} collapsed={hydrated && collapsed} />
        </Suspense>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors flex items-center justify-center"
        >
          <svg className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
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
