'use client';

import Link from 'next/link';
import StoreDiscovery from '@/components/marketplace/StoreDiscovery';

export default function StoresPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Local Game Stores</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Find shops near you on Grimoire</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">About this directory</p>
          <ul className="text-sm text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
            <li>These are local game stores that have joined Grimoire and made their single card inventory searchable.</li>
            <li>Click a store to browse their in-stock singles, see prices and conditions, and request holds.</li>
            <li>Use <Link href="/marketplace/find" className="text-zinc-300 underline underline-offset-2">Find Locally</Link> to search across all nearby stores at once for a specific card.</li>
          </ul>
          <div className="pt-1">
            <Link
              href="/marketplace/find"
              className="text-sm text-zinc-300 hover:text-zinc-100 underline underline-offset-2 transition-colors"
            >
              Search for a specific card →
            </Link>
          </div>
        </div>

        <StoreDiscovery />
      </div>
    </div>
  );
}
