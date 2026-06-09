'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setError('');
    setLoading(true);

    // 1. Register
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      return setError(data.error);
    }

    // 2. Auto sign-in after registration
    const result = await signIn('credentials', {
      username: form.username,
      password: form.password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      router.push('/login');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <h1 className="text-2xl font-black">
            <span className="text-amber-400">MTG</span> Deck Finder
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <input
              type="text" placeholder="Username" autoComplete="username"
              required minLength={3} maxLength={30}
              value={form.username} onChange={set('username')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            <input
              type="email" placeholder="Email" autoComplete="email" required
              value={form.email} onChange={set('email')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            <input
              type="password" placeholder="Password (8+ characters)" autoComplete="new-password"
              required minLength={8}
              value={form.password} onChange={set('password')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            <input
              type="password" placeholder="Confirm password" autoComplete="new-password" required
              value={form.confirm} onChange={set('confirm')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="text-amber-400 hover:text-amber-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
