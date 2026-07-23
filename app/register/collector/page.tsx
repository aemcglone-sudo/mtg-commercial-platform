'use client';

import Link from 'next/link';
import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';

function CollectorRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimHolds = searchParams.get('claimHolds') === 'true';
  const prefillEmail = searchParams.get('email') ?? '';

  const [form, setForm] = useState({ name: '', email: prefillEmail, password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefillEmail) setForm(prev => ({ ...prev, email: prefillEmail }));
  }, [prefillEmail]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register/collector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Registration failed'); return; }

      if (claimHolds) {
        await fetch('/api/auth/claim-guest-holds', { method: 'POST' });
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text" placeholder="Your name" autoComplete="name" required
        value={form.name} onChange={set('name')}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
      />
      <input
        type="email" placeholder="Email" autoComplete="email" required
        value={form.email} onChange={set('email')}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
      />
      <div className="space-y-2">
        <input
          type="password" placeholder="Password (8+ characters)" autoComplete="new-password" required minLength={8}
          value={form.password} onChange={set('password')}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <PasswordStrengthMeter password={form.password} />
      </div>
      <input
        type="password" placeholder="Confirm password" autoComplete="new-password" required
        value={form.confirm} onChange={set('confirm')}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
      />

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button
        type="submit" disabled={loading}
        className="w-full py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  );
}

export default function CollectorRegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black text-amber-400">Grimoire</h1>
          <p className="text-zinc-500 text-sm mt-1">Create your collector account</p>
        </div>

        <Suspense fallback={<div className="h-48 animate-pulse bg-zinc-900 rounded-xl" />}>
          <CollectorRegisterForm />
        </Suspense>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link href="/collector/login" className="text-amber-400 hover:text-amber-300 transition-colors">Sign in</Link>
        </p>
        <p className="text-center text-sm text-zinc-500">
          Opening a shop?{' '}
          <Link href="/register/shop" className="text-amber-400 hover:text-amber-300 transition-colors">Register as a shop owner</Link>
        </p>
      </div>
    </div>
  );
}
