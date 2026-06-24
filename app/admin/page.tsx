'use client';

import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black text-zinc-200">Grimoire Admin</h1>
          <p className="text-zinc-500 text-sm mt-1">Platform administration</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 opacity-50">
            <p className="text-zinc-200 font-semibold">Users</p>
            <p className="text-zinc-500 text-sm mt-1">Coming soon</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 opacity-50">
            <p className="text-zinc-200 font-semibold">Shops</p>
            <p className="text-zinc-500 text-sm mt-1">Coming soon</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 opacity-50">
            <p className="text-zinc-200 font-semibold">Orders</p>
            <p className="text-zinc-500 text-sm mt-1">Coming soon</p>
          </div>
        </div>

        <LogoutButton />
      </div>
    </div>
  );
}
