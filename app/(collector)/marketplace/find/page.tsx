'use client';

import FindLocally from '@/components/marketplace/FindLocally';

export default function FindLocallyPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Find Locally</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Search card inventory at nearby game stores</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">How it works</p>
          <ul className="text-sm text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
            <li>Type a card name and pick from the autocomplete — results show which nearby shops have it in stock, along with price and condition.</li>
            <li>Click <span className="text-zinc-300">Hold</span> to reserve a copy at a shop; the shop will confirm or decline within 24 hours.</li>
            <li>Once confirmed, you have <span className="text-zinc-300">72 hours</span> to visit the store and pay in person — no online payment is collected.</li>
            <li>You can cancel a pending hold at any time before the shop confirms it.</li>
            <li>Set your location and search radius in <a href="/marketplace/preferences" className="text-zinc-300 underline underline-offset-2">Marketplace Preferences</a> to control which stores appear.</li>
          </ul>
        </div>

        <FindLocally />
      </div>
    </div>
  );
}
