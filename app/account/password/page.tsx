'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) { setError('New passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      setSuccess(true);
      setForm({ current: '', next: '', confirm: '' });
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
          <p className="text-zinc-500 text-sm mt-1">Change password</p>
        </div>

        {success ? (
          <div className="space-y-6 text-center">
            <p className="text-emerald-400 bg-emerald-950 border border-emerald-800 rounded-xl py-4 px-5 text-sm">
              Password updated successfully.
            </p>
            <button
              onClick={() => router.back()}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              ← Go back
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password" placeholder="Current password" autoComplete="current-password" required
              value={form.current} onChange={set('current')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <input
              type="password" placeholder="New password (8+ characters)" autoComplete="new-password" required minLength={8}
              value={form.next} onChange={set('next')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <input
              type="password" placeholder="Confirm new password" autoComplete="new-password" required
              value={form.confirm} onChange={set('confirm')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>

            <button
              type="button" onClick={() => router.back()}
              className="w-full py-3 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}

        <div className="text-center">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
