'use client';

import { useEffect, useState } from 'react';

interface Props {
  item: {
    id: string;
    cardName: string;
    condition: string;
    foil: boolean;
    priceCents: number;
    imageUrl?: string | null;
  };
  slug: string;
  isLight?: boolean;
  accentHex?: string;
  onClose: () => void;
}

type Step = 'form' | 'success';

export default function HoldRequestModal({ item, slug, isLight, accentHex = '#22c55e', onClose }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [collectorNote, setCollectorNote] = useState('');
  const [pickupWindow, setPickupWindow] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  useEffect(() => {
    fetch('/api/auth/account').then(r => setIsLoggedIn(r.ok)).catch(() => setIsLoggedIn(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/storefront/${slug}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: item.id,
          guestName: isLoggedIn ? undefined : guestName,
          guestEmail: isLoggedIn ? undefined : guestEmail,
          collectorNote: collectorNote || undefined,
          pickupWindow: pickupWindow || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; holdId?: string; guestToken?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      setHoldToken(data.guestToken ?? null);
      setSubmittedEmail(guestEmail);
      setStep('success');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const bg = isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-zinc-700 text-zinc-100';
  const inputCls = isLight
    ? 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
    : 'bg-zinc-800 border-zinc-600 text-zinc-100 placeholder:text-zinc-500';
  const mutedCls = isLight ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className={`border rounded-2xl p-6 max-w-sm w-full shadow-2xl ${bg}`} onClick={e => e.stopPropagation()}>
        {step === 'form' ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Request Hold</h2>
                <p className={`text-sm mt-0.5 ${mutedCls}`}>
                  {item.cardName} · {item.condition}{item.foil ? ' · Foil' : ''} ·{' '}
                  <span style={{ color: accentHex }}>${(item.priceCents / 100).toFixed(2)}</span>
                </p>
              </div>
              <button type="button" onClick={onClose} className={`text-sm ${mutedCls} hover:text-zinc-300 ml-2`}>✕</button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {isLoggedIn === null && (
                <p className={`text-xs ${mutedCls} animate-pulse`}>Loading…</p>
              )}

              {isLoggedIn === false && (
                <>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${mutedCls}`}>Your Name *</label>
                    <input
                      required
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      placeholder="Full name"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${mutedCls}`}>Email Address *</label>
                    <input
                      required
                      type="email"
                      value={guestEmail}
                      onChange={e => setGuestEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${inputCls}`}
                    />
                  </div>
                </>
              )}

              <div>
                <label className={`block text-xs font-medium mb-1 ${mutedCls}`}>Pickup Window</label>
                <input
                  value={pickupWindow}
                  onChange={e => setPickupWindow(e.target.value)}
                  placeholder="e.g. Saturday afternoon"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${inputCls}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${mutedCls}`}>Note to Shop</label>
                <textarea
                  value={collectorNote}
                  onChange={e => setCollectorNote(e.target.value)}
                  placeholder="Any requests or questions…"
                  rows={2}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none ${inputCls}`}
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={submitting || isLoggedIn === null}
                style={{ backgroundColor: accentHex }}
                className="w-full text-white text-sm font-medium rounded-lg py-2.5 disabled:opacity-50 transition-opacity"
              >
                {submitting ? 'Submitting…' : 'Request Hold'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="text-center space-y-3 py-2">
              <div className="text-3xl">✅</div>
              <h2 className="text-base font-semibold">Hold Requested!</h2>
              <p className={`text-sm ${mutedCls}`}>
                The shop has been notified. They'll confirm or update you shortly.
              </p>

              {holdToken && (
                <div className={`rounded-xl border p-3 text-left space-y-1 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-700 bg-zinc-800'}`}>
                  <p className={`text-xs font-medium ${mutedCls}`}>Your reference</p>
                  <p className="font-mono text-sm font-semibold" style={{ color: accentHex }}>
                    HOLD-{holdToken.slice(0, 8).toUpperCase()}
                  </p>
                  <a
                    href={`/hold/${holdToken}`}
                    className="text-xs underline"
                    style={{ color: accentHex }}
                  >
                    View hold status →
                  </a>
                </div>
              )}

              {holdToken && (
                <div className={`rounded-xl border p-3 text-left space-y-1.5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-700 bg-zinc-800'}`}>
                  <p className={`text-xs font-semibold ${mutedCls}`}>Track all your holds →</p>
                  <p className={`text-xs ${mutedCls}`}>
                    Create a free Grimoire account to manage holds, build decks, and discover cards.
                  </p>
                  <a
                    href={`/register/collector?email=${encodeURIComponent(submittedEmail)}&claimHolds=true`}
                    className="inline-block text-xs font-medium rounded-lg px-3 py-1.5 text-white"
                    style={{ backgroundColor: accentHex }}
                  >
                    Create free account
                  </a>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`mt-4 w-full text-xs border rounded-lg py-1.5 transition-colors ${isLight ? 'border-zinc-200 text-zinc-500 hover:text-zinc-800' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
