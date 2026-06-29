'use client';

import { useState, useEffect } from 'react';

interface Campaign {
  id: string;
  title: string;
  body: string;
  type: string;
  status: string;
  sentAt: string | null;
  recipientCount: number;
  createdAt: string;
}

interface RateLimit {
  remaining: number;
  used: number;
  weekOf: string;
}

const CAMPAIGN_TYPES = [
  { value: 'general', label: 'General Announcement' },
  { value: 'sale', label: 'Sale / Promotion' },
  { value: 'new_arrival', label: 'New Arrivals' },
  { value: 'buy_list', label: 'Buy List Update' },
  { value: 'event', label: 'Event / Tournament' },
];

export default function LocalCampaignBuilder() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('general');
  const [reach, setReach] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [camRes, rlRes] = await Promise.all([
      fetch('/api/marketplace/shop/campaigns'),
      fetch('/api/marketplace/shop/campaigns/rate-limit'),
    ]);
    if (camRes.ok) {
      const data = await camRes.json() as { campaigns: Campaign[] };
      setCampaigns(data.campaigns);
    }
    if (rlRes.ok) setRateLimit(await rlRes.json() as RateLimit);
    setLoading(false);
  }

  useEffect(() => {
    if (!showForm) return;
    const t = setTimeout(async () => {
      const res = await fetch('/api/marketplace/shop/campaigns/reach');
      if (res.ok) {
        const data = await res.json() as { estimatedRecipients: number };
        setReach(data.estimatedRecipients);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [showForm]);

  async function saveDraft() {
    if (!title.trim() || !body.trim()) { setError('Title and message are required'); return; }
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/marketplace/shop/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, type }),
    });
    if (res.ok) {
      const data = await res.json() as { campaign: Campaign };
      setCampaigns(cs => [data.campaign, ...cs]);
      setShowForm(false);
      setTitle(''); setBody(''); setType('general');
    }
    setSubmitting(false);
  }

  async function sendCampaign(id: string) {
    if (!confirm('Send this campaign to all opted-in collectors nearby? This counts against your weekly limit.')) return;
    setSending(id);
    setError('');
    const res = await fetch(`/api/marketplace/shop/campaigns/${id}/send`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json() as { recipientCount: number };
      setSuccess(`Campaign sent to ${data.recipientCount} collector${data.recipientCount !== 1 ? 's' : ''}!`);
      await load();
    } else {
      const data = await res.json() as { error?: string };
      setError(data.error ?? 'Failed to send');
    }
    setSending(null);
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      draft: 'bg-zinc-800 text-zinc-400',
      sent: 'bg-emerald-900/40 text-emerald-400',
    };
    return map[status] ?? 'bg-zinc-800 text-zinc-400';
  }

  if (loading) return <div className="py-12 text-center text-zinc-600 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3 text-sm text-emerald-300">
          ✅ {success}
          <button type="button" onClick={() => setSuccess('')} className="ml-3 text-emerald-500 hover:text-emerald-300">✕</button>
        </div>
      )}

      {rateLimit && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-zinc-400">Weekly campaigns remaining</span>
          <span className={`text-sm font-semibold ${rateLimit.remaining === 0 ? 'text-red-400' : 'text-zinc-100'}`}>
            {rateLimit.remaining} / 3
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-100">Collector Campaigns</h2>
        {!showForm && rateLimit && rateLimit.remaining > 0 && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Campaign
          </button>
        )}
      </div>

      {/* Compose form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-zinc-100">Create Campaign</h3>

          {reach !== null && (
            <p className="text-xs text-zinc-500">
              Est. reach: <span className="text-zinc-300 font-medium">{reach} collector{reach !== 1 ? 's' : ''}</span> opted in within your area
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Subject</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. 20% off singles this weekend"
                maxLength={80}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Message</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="What do collectors need to know?"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
              />
              <p className="text-xs text-zinc-600 mt-1 text-right">{body.length}/300</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="text-xs text-zinc-600 leading-relaxed">
            Campaign saved as draft. You can send from the list below. Max 3 campaigns per week. Sent as in-app notifications + SMS to opted-in collectors.
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">Cancel</button>
            <button type="button" onClick={saveDraft} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-zinc-700 text-zinc-100 text-sm font-semibold hover:bg-zinc-600 transition-colors disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-12">No campaigns yet. Create one to reach collectors near your store.</p>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-zinc-100 text-sm">{c.title}</p>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusBadge(c.status)}`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{CAMPAIGN_TYPES.find(t => t.value === c.type)?.label ?? c.type}</p>
                </div>
                <span className="text-xs text-zinc-600 shrink-0">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{c.body}</p>
              {c.status === 'sent' && c.sentAt && (
                <p className="text-xs text-zinc-600">Sent {new Date(c.sentAt).toLocaleDateString()} · {c.recipientCount} recipient{c.recipientCount !== 1 ? 's' : ''}</p>
              )}
              {c.status === 'draft' && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => sendCampaign(c.id)}
                    disabled={sending === c.id || (rateLimit?.remaining ?? 0) === 0}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {sending === c.id ? 'Sending…' : 'Send Now'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
