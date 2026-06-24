'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const params = useSearchParams();
  const signedOut = params.get('signed-out');

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black text-amber-400">Grimoire</h1>
          <p className="text-zinc-500 text-sm mt-1">Who are you signing in as?</p>
        </div>

        {signedOut && (
          <p className="text-center text-sm text-emerald-400 bg-emerald-950 border border-emerald-800 rounded-xl py-3 px-4">
            You&apos;ve been signed out successfully.
          </p>
        )}

        <div className="space-y-3">
          <Link href="/collector/login" className="flex items-center justify-between w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500 rounded-xl px-5 py-4 transition-colors group">
            <div className="text-left">
              <p className="text-zinc-200 font-semibold text-sm">Collector</p>
              <p className="text-zinc-500 text-xs mt-0.5">Browse and manage your card collection</p>
            </div>
            <span className="text-zinc-600 group-hover:text-amber-400 transition-colors text-lg">→</span>
          </Link>

          <Link href="/shop/login" className="flex items-center justify-between w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500 rounded-xl px-5 py-4 transition-colors group">
            <div className="text-left">
              <p className="text-zinc-200 font-semibold text-sm">Shop Owner</p>
              <p className="text-zinc-500 text-xs mt-0.5">Manage your store and inventory</p>
            </div>
            <span className="text-zinc-600 group-hover:text-amber-400 transition-colors text-lg">→</span>
          </Link>

          <Link href="/admin/login" className="flex items-center justify-between w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded-xl px-5 py-4 transition-colors group">
            <div className="text-left">
              <p className="text-zinc-400 font-semibold text-sm">Admin</p>
              <p className="text-zinc-600 text-xs mt-0.5">Platform administration</p>
            </div>
            <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors text-lg">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
