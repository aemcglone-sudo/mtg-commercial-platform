'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'collector' | 'shop_owner';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('collector');
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
      if (!res.ok) {
        setError(data.error ?? 'Invalid email or password');
        return;
      }
      const userRole = data.role;
      if (userRole === 'admin') router.push('/admin');
      else if (userRole === 'shop_owner') router.push('/shop/dashboard');
      else router.push('/collection');
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
          <p className="text-zinc-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('collector')}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                role === 'collector' ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Collector
            </button>
            <button
              type="button"
              onClick={() => setRole('shop_owner')}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                role === 'shop_owner' ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Shop Owner
            </button>
          </div>

          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Don&apos;t have an account?{' '}
          <Link
            href={role === 'shop_owner' ? '/register/shop' : '/register/collector'}
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
