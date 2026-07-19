'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface AccountData {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  allowedRoles: string[];
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  collector: 'Collector',
  shop_owner: 'Shop Owner',
  admin: 'Admin',
};

const ROLE_HOME: Record<string, string> = {
  collector: '/',
  shop_owner: '/shop/dashboard',
  admin: '/admin',
};

export default function UserAvatarMenu() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/account')
      .then(r => r.ok ? r.json() : null)
      .then((d: AccountData | null) => setAccount(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!account) return null;

  const initials = (account.name ?? account.email).slice(0, 2).toUpperCase();
  const switchableRoles = account.allowedRoles.filter(r => r !== account.role);

  async function switchRole(role: string) {
    setSwitching(true);
    const res = await fetch('/api/auth/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setOpen(false);
      router.push(ROLE_HOME[role] ?? '/');
      router.refresh();
    }
    setSwitching(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full overflow-hidden border-2 border-zinc-700 hover:border-amber-400 transition-colors focus:outline-none"
        aria-label="Account menu"
      >
        {account.avatarUrl ? (
          <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Identity */}
          <div className="px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">{account.name ?? 'User'}</p>
                <p className="text-xs text-zinc-500 truncate">{account.email}</p>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Active role</span>
              <p className="text-xs font-medium text-amber-400">{ROLE_LABELS[account.role] ?? account.role}</p>
            </div>
          </div>

          {/* Role switcher */}
          {switchableRoles.length > 0 && (
            <div className="border-b border-zinc-800 py-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 px-4 pt-2 pb-1">Switch to</p>
              {switchableRoles.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => switchRole(role)}
                  disabled={switching}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-50"
                >
                  {ROLE_LABELS[role] ?? role}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="py-1">
            <a
              href={account.role === 'shop_owner' ? '/shop/settings' : account.role === 'admin' ? '/admin' : '/settings'}
              className="block px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              onClick={() => setOpen(false)}
            >
              Settings
            </a>
            <a
              href="/api/auth/logout"
              className="block px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
            >
              Sign out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
