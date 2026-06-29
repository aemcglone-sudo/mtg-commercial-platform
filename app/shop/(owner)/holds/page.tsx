'use client';

import ShopHoldQueue from '@/components/marketplace/shop/ShopHoldQueue';
import ShopHoldStats from '@/components/marketplace/shop/ShopHoldStats';

export default function ShopHoldsPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Hold Queue</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Manage card hold requests from local collectors</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">How holds work</p>
          <ul className="text-sm text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
            <li>Holds are requests from local collectors to reserve a card for in-store pickup.</li>
            <li>You have <span className="text-zinc-300">24 hours</span> to confirm or decline each request — unreviewed holds expire automatically.</li>
            <li>Once confirmed, the collector has <span className="text-zinc-300">72 hours</span> to visit your store and pay in person.</li>
            <li>Marking a hold as completed deducts the card from your inventory.</li>
            <li>Holds that aren&apos;t picked up within the window are auto-cancelled by the nightly cron job.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Stats</p>
          <ShopHoldStats />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Queue</p>
          <ShopHoldQueue />
        </div>
      </div>
    </div>
  );
}
