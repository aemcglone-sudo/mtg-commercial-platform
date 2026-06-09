'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', {
      username: form.username,
      password: form.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('Invalid username or password');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <h1 className="text-2xl font-black">
            <span className="text-amber-400">MTG</span> Deck Finder
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Username or email"
              autoComplete="username"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          No account?{' '}
          <Link href="/register" className="text-amber-400 hover:text-amber-300">
            Create one
          </Link>
        </p>

        {/* Placeholder for future OAuth buttons */}
        {/* <div className="relative my-4">
          <div className="border-t border-zinc-800" />
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-zinc-950 px-3 text-xs text-zinc-600">or</span>
        </div>
        <button className="...">Continue with Google</button> */}
      </div>
    </div>
  );
}
