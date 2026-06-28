'use client';

import { useState } from 'react';

interface Props {
  format: string;
  fetchedAt: string | null;
  confidence: number;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function BanListBanner({ format, fetchedAt, confidence, onRefresh, refreshing }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !fetchedAt) return null;

  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const ageHours = Math.floor(ageMs / 3600000);
  const ageStr = ageHours < 1 ? 'just now' : ageHours < 24 ? `${ageHours}h ago` : `${Math.floor(ageHours / 24)}d ago`;
  const isStale = ageHours >= 20;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs border ${isStale ? 'bg-amber-900/20 border-amber-800 text-amber-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
      <span>{isStale ? '⚠️' : '✓'}</span>
      <span>
        <span className="font-medium">{format.charAt(0).toUpperCase() + format.slice(1)}</span> ban list verified {ageStr}
        {confidence > 0 && ` · ${Math.round(confidence * 100)}% confidence`}
      </span>
      <button type="button" onClick={onRefresh} disabled={refreshing}
        className="ml-auto text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50">
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
      <button type="button" onClick={() => setDismissed(true)} className="text-zinc-600 hover:text-zinc-400">✕</button>
    </div>
  );
}
