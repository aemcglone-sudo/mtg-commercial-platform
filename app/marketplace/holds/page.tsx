import CollectorHoldList from '@/components/marketplace/collector/CollectorHoldList';

export const metadata = { title: 'My Holds — Grimoire' };

export default function CollectorHoldsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">My Holds</h1>
      <CollectorHoldList />
    </div>
  );
}
