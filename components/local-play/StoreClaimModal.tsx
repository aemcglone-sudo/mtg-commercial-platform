'use client';

import { useState } from 'react';

interface Props {
  storeId: string;
  storeName: string;
  onClose: () => void;
}

export default function StoreClaimModal({ storeId, storeName, onClose }: Props) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/local-play/stores/${storeId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_note: note }),
      });
      if (res.status === 409) { setError('A claim is already pending for this store.'); return; }
      if (!res.ok) { setError('Failed to submit claim. Please try again.'); return; }
      setDone(true);
    } catch {
      setError('Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        {done ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">✅</div>
            <h3 className="font-bold text-zinc-100 text-lg mb-2">Claim Submitted</h3>
            <p className="text-zinc-400 text-sm mb-4">
              We'll review your claim for <strong>{storeName}</strong> and reach out within 2-3 business days.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-6 py-2 rounded-xl text-sm transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-zinc-100 text-lg mb-1">Claim {storeName}</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Tell us how you can verify you own or manage this store. We'll contact you to complete the process.
            </p>

            <div className="mb-4">
              <label className="text-xs text-zinc-500 mb-1 block">How can you prove ownership?</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={4}
                placeholder="e.g. I'm the owner, my name is on the Google listing, I can show a business license..."
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !note.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit Claim'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
