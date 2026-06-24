'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function ShopLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { error?: string; role?: string };
      if (!res.ok) { setError(data.error ?? 'Invalid email or password'); return; }
      if (data.role !== 'shop_owner') { setError('This account is not a shop owner account.'); return; }
      router.push('/shop/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black text-amber-400">Grimoire</h1>
          <p className="text-zinc-500 text-sm mt-1">Shop owner sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email" placeholder="Email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <input
            type="password" placeholder="Password" autoComplete="current-password" required
            value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Don&apos;t have an account?{' '}
          <Link href="/register/shop" className="text-amber-400 hover:text-amber-300 transition-colors">
            Register your shop
          </Link>
        </p>
        <p className="text-center text-sm text-zinc-600">
          Collector?{' '}
          <Link href="/collector/login" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            Collector login
          </Link>
        </p>
      </div>
    </div>
  );
}
