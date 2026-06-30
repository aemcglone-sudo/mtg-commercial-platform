'use client';

import { useState } from 'react';
import FindLocally from '@/components/marketplace/FindLocally';
import CollectorHoldList from '@/components/marketplace/collector/CollectorHoldList';

export default function CardFinderPage() {
  const [tab, setTab] = useState<'search' | 'holds'>('search');

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Card Finder</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Find cards at nearby shops or buy online</p>
        </div>

        <div className="flex gap-1 border-b border-zinc-800">
          {(['search', 'holds'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-emerald-500 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'search' ? 'Find a Card' : 'My Holds'}
            </button>
          ))}
        </div>

        {tab === 'search' ? (
          <FindLocally />
        ) : (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">About holds</p>
              <ul className="text-sm text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
                <li><span className="text-zinc-300">Pending</span> holds are awaiting shop confirmation — the shop has 24 hours to respond.</li>
                <li><span className="text-zinc-300">Confirmed</span> holds mean the card is set aside and ready — go pick it up and pay in store within 72 hours.</li>
                <li>You can cancel a pending hold at any time before the shop confirms it.</li>
                <li>Holds that aren&apos;t picked up within the pickup window expire automatically.</li>
              </ul>
            </div>
            <CollectorHoldList />
          </>
        )}
      </div>
    </div>
  );
}
