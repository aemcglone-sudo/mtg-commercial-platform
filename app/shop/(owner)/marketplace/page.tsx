import LocalCampaignBuilder from '@/components/marketplace/shop/LocalCampaignBuilder';
import ShopMarketplaceSetup from '@/components/marketplace/shop/ShopMarketplaceSetup';

export const metadata = { title: 'Local Marketplace — Grimoire Shop' };

export default function ShopMarketplacePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Local Marketplace</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Reach collectors near your store with inventory alerts and campaigns</p>
      </div>
      <ShopMarketplaceSetup />
      <LocalCampaignBuilder />
    </div>
  );
}
