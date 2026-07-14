'use client';

import { useEffect, useState } from 'react';

interface Claim {
  id: string;
  discovered_store_id: string;
  requesting_user_id: string;
  status: string;
  verification_note: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  store_name: string;
  store_address: string | null;
  store_city: string | null;
  requester_username: string;
  requester_email: string;
}

export default function StoreClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/store-claims?status=${statusFilter}`)
      .then(r => r.json())
      .then((d: { claims?: Claim[] }) => setClaims(d.claims ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  async function reviewClaim(id: string, status: 'approved' | 'rejected') {
    await fetch(`/api/admin/store-claims/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_note: adminNote }),
    });
    setClaims(prev => prev.filter(c => c.id !== id));
    setReviewingId(null);
    setAdminNote('');
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Store Claims</h1>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? 'bg-amber-500 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-zinc-500 text-sm">Loading…</div>}

      {!loading && claims.length === 0 && (
        <div className="text-zinc-500 text-sm">No {statusFilter} claims.</div>
      )}

      <div className="space-y-3">
        {claims.map(claim => (
          <div key={claim.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="font-semibold text-zinc-100">{claim.store_name}</h3>
                {claim.store_address && (
                  <p className="text-xs text-zinc-500">{claim.store_address}{claim.store_city ? `, ${claim.store_city}` : ''}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">{claim.requester_username}</p>
                <p className="text-xs text-zinc-600">{claim.requester_email}</p>
                <p className="text-xs text-zinc-600">{new Date(claim.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {claim.verification_note && (
              <div className="bg-zinc-800 rounded-lg p-3 mb-3">
                <p className="text-xs text-zinc-400 font-medium mb-1">Verification note:</p>
                <p className="text-sm text-zinc-300">{claim.verification_note}</p>
              </div>
            )}

            {statusFilter === 'pending' && (
              <>
                {reviewingId === claim.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={adminNote}
                      onChange={e => setAdminNote(e.target.value)}
                      placeholder="Admin note (optional)"
                      rows={2}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => reviewClaim(claim.id, 'approved')}
                        className="bg-green-700 hover:bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewClaim(claim.id, 'rejected')}
                        className="bg-red-800 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReviewingId(null); setAdminNote(''); }}
                        className="text-zinc-500 hover:text-zinc-300 text-xs px-3 py-2 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReviewingId(claim.id)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-4 py-2 rounded-lg transition-colors"
                  >
                    Review
                  </button>
                )}
              </>
            )}

            {claim.admin_note && (
              <p className="text-xs text-zinc-500 mt-2">Admin note: {claim.admin_note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
