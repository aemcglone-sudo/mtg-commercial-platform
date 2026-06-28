'use client';

import { useState, useEffect } from 'react';

export default function MtgRulesPage() {
  const [value, setValue] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { value: string; updatedAt: string | null }) => {
        setValue(d.value);
        setUpdatedAt(d.updatedAt);
      })
      .catch(() => setError('Failed to load rules.'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setUpdatedAt(new Date().toISOString());
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">MTG Deck Building Rules</h1>
          <p className="text-sm text-zinc-500 mt-1">
            This document is injected into the AI wizard when generating card suggestions. Use Markdown.
            {updatedAt && (
              <span className="ml-2 text-zinc-600">
                Last updated {new Date(updatedAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold text-sm transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 rounded-xl border border-green-800 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          ✓ Rules saved — the wizard will use the updated document on the next suggestion request.
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
          <span className="text-xs text-zinc-600 font-mono">docs/mtg-formats-guide (editable)</span>
          <span className="ml-auto text-xs text-zinc-700">{value.length.toLocaleString()} chars</span>
        </div>
        {loading ? (
          <div className="h-96 flex items-center justify-center text-zinc-600 text-sm">Loading…</div>
        ) : (
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full h-[70vh] bg-zinc-950 text-zinc-300 text-sm font-mono px-4 py-4 resize-none focus:outline-none"
            spellCheck={false}
            placeholder="Paste or type your MTG rules and guidelines here..."
          />
        )}
      </div>

      <p className="text-xs text-zinc-700 mt-3">
        Tip: Use Markdown headers (##), bullet points, and tables. The first 4,000 characters are sent to the AI per request.
        Keep the most important format rules and ratios near the top.
      </p>
    </div>
  );
}
