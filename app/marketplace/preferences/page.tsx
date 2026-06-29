import CollectorMarketplacePrefs from '@/components/marketplace/collector/CollectorMarketplacePrefs';

export const metadata = { title: 'Marketplace Preferences — Grimoire' };

export default function MarketplacePrefsPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Marketplace Preferences</h1>
      <CollectorMarketplacePrefs />
    </div>
  );
}
