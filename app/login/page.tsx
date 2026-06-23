'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'enthusiast' | 'shop_owner';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('enthusiast');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, role }),
      });

      if (res.ok) {
        router.push(role === 'shop_owner' ? '/shop/dashboard' : '/');
        router.refresh();
      } else {
        setError('Invalid passcode');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <h1 className="text-2xl font-black">
            <span className="text-amber-400">Grimoire</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('enthusiast')}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                role === 'enthusiast'
                  ? 'bg-amber-400 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Collector
            </button>
            <button
              type="button"
              onClick={() => setRole('shop_owner')}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                role === 'shop_owner'
                  ? 'bg-amber-400 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Shop Owner
            </button>
          </div>

          <input
            type="password"
            placeholder="Passcode"
            autoComplete="off"
            required
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Verifying…' : 'Enter'}
          </button>
        </form>

      </div>
    </div>
  );
}
