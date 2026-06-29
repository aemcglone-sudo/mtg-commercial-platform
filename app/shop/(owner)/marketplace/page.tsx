'use client';

import LocalCampaignBuilder from '@/components/marketplace/shop/LocalCampaignBuilder';
import ShopMarketplaceSetup from '@/components/marketplace/shop/ShopMarketplaceSetup';

export default function ShopMarketplacePage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Local Marketplace</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Reach collectors near your store</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">How it works</p>
          <ul className="text-sm text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
            <li>Collectors within your store&apos;s search radius can browse your inventory and see card prices and conditions.</li>
            <li>You control which cards are discoverable — only inventory you&apos;ve added to Grimoire will appear in searches.</li>
            <li>Collectors can request holds on cards they want; you review and confirm or decline each request.</li>
            <li>All transactions happen in person — collectors pick up and pay at your store, no online payment required.</li>
            <li>Campaigns let you broadcast announcements (buylist updates, sales, new stock) to opted-in collectors nearby.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Setup</p>
          <ShopMarketplaceSetup />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Campaigns</p>
          <LocalCampaignBuilder />
        </div>
      </div>
    </div>
  );
}
