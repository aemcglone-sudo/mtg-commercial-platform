import StoreDiscovery from '@/components/marketplace/StoreDiscovery';

export const metadata = { title: 'Local Game Stores — Grimoire' };

export default function StoresPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Local Game Stores</h1>
      <p className="text-zinc-500 text-sm mb-8">Find shops near you with active inventory on Grimoire.</p>
      <StoreDiscovery />
    </div>
  );
}
