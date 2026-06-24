'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login?signed-out=1');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={className ?? 'text-sm text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50'}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
