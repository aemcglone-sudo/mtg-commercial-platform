'use client';

import { useState, useEffect } from 'react';

interface Hold {
  id: string;
  status: string;
  cardName: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  imageUrl: string;
  collectorName: string;
  collectorEmail: string;
  pickupWindow: string;
  collectorNote: string;
  shopNote: string;
  createdAt: string;
  expiresAt: string;
  pickupExpiresAt: string;
}

interface GroupedHolds {
  requested: Hold[];
  confirmed: Hold[];
  completed: Hold[];
  declined: Hold[];
  cancelled: Hold[];
  expired: Hold[];
}

const STATUS_ORDER = ['requested', 'confirmed', 'completed', 'declined', 'cancelled', 'expired'] as const;
const STATUS_LABELS: Record<string, string> = {
  requested: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export default function ShopHoldQueue() {
  const [grouped, setGrouped] = useState<GroupedHolds>({ requested: [], confirmed: [], completed: [], declined: [], cancelled: [], expired: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('requested');
  const [confirmModal, setConfirmModal] = useState<Hold | null>(null);
  const [declineModal, setDeclineModal] = useState<Hold | null>(null);
  const [shopNote, setShopNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/marketplace/shop/holds');
    if (res.ok) {
      const data = await res.json() as GroupedHolds;
      setGrouped(data);
    }
    setLoading(false);
  }

  async function confirmHold() {
    if (!confirmModal) return;
    setSubmitting(true);
    await fetch(`/api/marketplace/holds/${confirmModal.id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopNote }),
    });
    setConfirmModal(null);
    setShopNote('');
    setSubmitting(false);
    await load();
  }

  async function declineHold() {
    if (!declineModal) return;
    setSubmitting(true);
    await fetch(`/api/marketplace/holds/${declineModal.id}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopNote }),
    });
    setDeclineModal(null);
    setShopNote('');
    setSubmitting(false);
    await load();
  }

  async function completeHold(id: string) {
    if (!confirm('Mark this hold as completed (card picked up)?')) return;
    await fetch(`/api/marketplace/holds/${id}/complete`, { method: 'POST' });
    await load();
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function expiryLabel(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hrs = Math.floor(diff / 3600000);
    return hrs < 24 ? `${hrs}h left` : `${Math.floor(hrs / 24)}d left`;
  }

  const currentHolds = (grouped[activeTab as keyof GroupedHolds] ?? []);

  if (loading) return <div className="py-12 text-center text-zinc-600 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 overflow-x-auto">
        {STATUS_ORDER.map(s => {
          const count = grouped[s]?.length ?? 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveTab(s)}
              className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === s ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {STATUS_LABELS[s]}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${s === 'requested' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-700 text-zinc-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hold cards */}
      {currentHolds.length === 0 ? (
        <p className="text-center text-zinc-600 text-sm py-12">No {STATUS_LABELS[activeTab]?.toLowerCase()} holds</p>
      ) : (
        <div className="space-y-4">
          {currentHolds.map(h => (
            <div key={h.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-4">
                {h.imageUrl && <img src={h.imageUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-100">{h.cardName}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{h.condition}{h.foil ? ' · Foil' : ''} · <span className="text-amber-400">${(h.priceCents / 100).toFixed(2)}</span></p>
                    </div>
                    <span className="text-xs text-zinc-600 shrink-0">{timeAgo(h.createdAt)}</span>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-sm text-zinc-300">{h.collectorName}</p>
                    <p className="text-xs text-zinc-500">{h.collectorEmail}</p>
                  </div>
                  {h.pickupWindow && (
                    <p className="text-xs text-zinc-500 mt-1">Pickup: {h.pickupWindow}</p>
                  )}
                  {h.collectorNote && (
                    <div className="mt-2 bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-400">
                      "{h.collectorNote}"
                    </div>
                  )}
                  {h.shopNote && (
                    <div className="mt-1 bg-zinc-800/50 rounded-lg px-3 py-1.5 text-xs text-zinc-500">
                      Your note: {h.shopNote}
                    </div>
                  )}
                  {activeTab === 'requested' && h.expiresAt && (
                    <p className="text-xs text-yellow-500 mt-1">⏱ {expiryLabel(h.expiresAt)} to respond</p>
                  )}
                  {activeTab === 'confirmed' && h.pickupExpiresAt && (
                    <p className="text-xs text-emerald-400 mt-1">⏱ Customer has {expiryLabel(h.pickupExpiresAt)} to pick up</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {activeTab === 'requested' && (
                <div className="flex gap-2 pt-1 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => { setDeclineModal(h); setShopNote(''); }}
                    className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-sm font-medium hover:bg-zinc-700 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => { setConfirmModal(h); setShopNote(''); }}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
                  >
                    Confirm Hold
                  </button>
                </div>
              )}
              {activeTab === 'confirmed' && (
                <div className="flex justify-end pt-1 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => completeHold(h.id)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                  >
                    Mark Picked Up
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-100">Confirm Hold</h2>
            <div className="bg-zinc-800 rounded-xl p-3 text-sm space-y-0.5">
              <p className="text-zinc-100 font-medium">{confirmModal.cardName}</p>
              <p className="text-zinc-400">{confirmModal.condition}{confirmModal.foil ? ' · Foil' : ''} · ${(confirmModal.priceCents / 100).toFixed(2)}</p>
              <p className="text-zinc-500">For {confirmModal.collectorName}</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Note to collector <span className="text-zinc-600">(optional)</span></label>
              <textarea
                value={shopNote}
                onChange={e => setShopNote(e.target.value)}
                rows={2}
                placeholder="e.g. Card is at the front desk, ask for Mike"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>
            <p className="text-xs text-zinc-600">The collector will be notified and has 72 hours to pick up.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">Cancel</button>
              <button type="button" onClick={confirmHold} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50">
                {submitting ? 'Confirming…' : 'Confirm & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {declineModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setDeclineModal(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-100">Decline Hold</h2>
            <div className="bg-zinc-800 rounded-xl p-3 text-sm space-y-0.5">
              <p className="text-zinc-100 font-medium">{declineModal.cardName}</p>
              <p className="text-zinc-500">For {declineModal.collectorName}</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Reason <span className="text-zinc-600">(optional)</span></label>
              <textarea
                value={shopNote}
                onChange={e => setShopNote(e.target.value)}
                rows={2}
                placeholder="e.g. Item no longer in stock"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeclineModal(null)} className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">Back</button>
              <button type="button" onClick={declineHold} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
                {submitting ? 'Declining…' : 'Decline & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
