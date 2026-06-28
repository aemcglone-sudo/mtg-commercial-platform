'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type CampaignStatus = 'active' | 'dismissed' | 'launched';

interface Campaign {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  status: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; icon: string; urgency: 'urgent' | 'suggested' | 'khoa' }> = {
  price_spike: { label: 'Price Spike', icon: '📈', urgency: 'urgent' },
  bnr: { label: 'Banned & Restricted', icon: '🚫', urgency: 'urgent' },
  trending_deck: { label: 'Trending Deck', icon: '🏆', urgency: 'suggested' },
  set_release: { label: 'Set Release', icon: '📦', urgency: 'suggested' },
  bundle: { label: 'Bundle Opportunity', icon: '🎁', urgency: 'khoa' },
  wishlist_demand: { label: 'Wishlist Demand', icon: '⭐', urgency: 'khoa' },
};

const STATUS_TABS: CampaignStatus[] = ['active', 'launched', 'dismissed'];

function urgencyGroup(campaigns: Campaign[]) {
  const urgent = campaigns.filter(c => TYPE_LABELS[c.type]?.urgency === 'urgent');
  const suggested = campaigns.filter(c => TYPE_LABELS[c.type]?.urgency === 'suggested');
  const khoa = campaigns.filter(c => TYPE_LABELS[c.type]?.urgency === 'khoa' || !TYPE_LABELS[c.type]);
  return { urgent, suggested, khoa };
}

function CampaignCard({ campaign, onDismiss, onLaunch, onRestore }: {
  campaign: Campaign;
  onDismiss: (id: string) => void;
  onLaunch: (id: string) => void;
  onRestore?: (id: string) => void;
}) {
  const meta = TYPE_LABELS[campaign.type] ?? { label: campaign.type, icon: '💡', urgency: 'khoa' as const };
  const isNew = Date.now() - new Date(campaign.createdAt).getTime() < 24 * 3600 * 1000;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">{meta.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{meta.label}</span>
              {isNew && meta.urgency === 'urgent' && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-900/60 text-red-300 border border-red-700">URGENT</span>
              )}
            </div>
            <h3 className="font-semibold text-zinc-100 leading-snug">{campaign.title}</h3>
          </div>
        </div>
        <span className="text-xs text-zinc-600 shrink-0">{new Date(campaign.createdAt).toLocaleDateString()}</span>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed">{campaign.body}</p>

      {campaign.status === 'active' && (
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={() => onLaunch(campaign.id)}
            className="px-4 py-2 text-sm rounded-xl bg-amber-400/20 border border-amber-500/40 text-amber-300 hover:bg-amber-400/30 transition-colors font-medium">
            Launch
          </button>
          <button type="button" onClick={() => onDismiss(campaign.id)}
            className="px-4 py-2 text-sm rounded-xl border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors">
            Dismiss
          </button>
        </div>
      )}
      {campaign.status === 'launched' && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-green-400 font-medium">Launched</span>
          <button type="button" onClick={() => onDismiss(campaign.id)}
            className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors">
            Archive
          </button>
        </div>
      )}
      {campaign.status === 'dismissed' && onRestore && (
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={() => onRestore(campaign.id)}
            className="px-4 py-2 text-sm rounded-xl bg-zinc-700/60 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors font-medium">
            Restore
          </button>
        </div>
      )}
    </div>
  );
}

function Group({ title, campaigns, onDismiss, onLaunch, onRestore }: {
  title: string;
  campaigns: Campaign[];
  onDismiss: (id: string) => void;
  onLaunch: (id: string) => void;
  onRestore?: (id: string) => void;
}) {
  if (campaigns.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h2>
      <div className="space-y-3">
        {campaigns.map(c => <CampaignCard key={c.id} campaign={c} onDismiss={onDismiss} onLaunch={onLaunch} onRestore={onRestore} />)}
      </div>
    </div>
  );
}

function CampaignsContent() {
  const searchParams = useSearchParams();
  const rawStatus = (searchParams.get('status') ?? 'active') as CampaignStatus;
  const activeStatus: CampaignStatus = STATUS_TABS.includes(rawStatus) ? rawStatus : 'active';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCampaigns([]);
    fetch(`/api/shops/campaigns?status=${activeStatus}`)
      .then(r => r.ok ? r.json() as Promise<{ campaigns: Campaign[] }> : Promise.reject())
      .then(data => { if (!cancelled) setCampaigns(data.campaigns); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeStatus]);

  function setStatus(s: CampaignStatus) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', s);
    window.history.pushState(null, '', `?${params.toString()}`);
  }

  function handleDismiss(id: string) {
    fetch(`/api/shops/campaigns/${id}/dismiss`, { method: 'POST' }).catch(() => {});
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }

  function handleLaunch(id: string) {
    fetch(`/api/shops/campaigns/${id}/launch`, { method: 'POST' }).catch(() => {});
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'launched' } : c));
  }

  function handleRestore(id: string) {
    fetch(`/api/shops/campaigns/${id}/restore`, { method: 'POST' }).catch(() => {});
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }

  const { urgent, suggested, khoa } = urgencyGroup(campaigns);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Campaigns</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Smart suggestions based on your inventory</p>
        </div>

        <div className="flex gap-1 bg-zinc-900/50 rounded-xl p-1 border border-zinc-800 w-fit">
          {STATUS_TABS.map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${activeStatus === s ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {s}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-zinc-600 text-sm">
            <svg className="w-5 h-5 animate-spin text-amber-400 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
            </svg>
            Generating campaigns…
          </div>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-zinc-400">No {activeStatus} campaigns</p>
            {activeStatus === 'active' && (
              <p className="text-zinc-600 text-sm mt-2">Campaigns are generated when sets release, decks trend, or prices move.</p>
            )}
          </div>
        )}

        {!loading && campaigns.length > 0 && (
          <div className="space-y-6">
            <Group title="Urgent" campaigns={urgent} onDismiss={handleDismiss} onLaunch={handleLaunch} onRestore={handleRestore} />
            <Group title="Suggested" campaigns={suggested} onDismiss={handleDismiss} onLaunch={handleLaunch} onRestore={handleRestore} />
            <Group title="Khoa Suggests" campaigns={khoa} onDismiss={handleDismiss} onLaunch={handleLaunch} onRestore={handleRestore} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  return <Suspense><CampaignsContent /></Suspense>;
}
