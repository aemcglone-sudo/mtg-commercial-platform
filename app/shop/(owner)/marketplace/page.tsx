'use client';

import LocalCampaignBuilder from '@/components/marketplace/shop/LocalCampaignBuilder';

export default function ShopMarketplacePage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Local Marketplace</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Reach collectors near your store</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Campaigns</p>
          <LocalCampaignBuilder />
        </div>
      </div>
    </div>
  );
}
