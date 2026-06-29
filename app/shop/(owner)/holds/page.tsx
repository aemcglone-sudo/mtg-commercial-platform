import ShopHoldQueue from '@/components/marketplace/shop/ShopHoldQueue';
import ShopHoldStats from '@/components/marketplace/shop/ShopHoldStats';

export const metadata = { title: 'Hold Queue — Grimoire Shop' };

export default function ShopHoldsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Hold Queue</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Manage card hold requests from local collectors</p>
      </div>
      <ShopHoldStats />
      <ShopHoldQueue />
    </div>
  );
}
