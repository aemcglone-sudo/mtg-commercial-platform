'use client';

import CollectorMarketplacePrefs from '@/components/marketplace/collector/CollectorMarketplacePrefs';

export default function MarketplacePrefsPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Marketplace Preferences</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Control how the local marketplace works for you</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Settings guide</p>
          <ul className="text-sm text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
            <li>Set your location so we can show nearby shops and calculate distances accurately.</li>
            <li>Your search radius controls how far away a store can be and still appear in results.</li>
            <li>Opt in to notifications to be alerted when cards on your watchlist become available at a nearby shop.</li>
            <li>SMS notifications require a verified phone number and are delivered via Twilio — standard messaging rates may apply.</li>
          </ul>
        </div>

        <CollectorMarketplacePrefs />
      </div>
    </div>
  );
}
