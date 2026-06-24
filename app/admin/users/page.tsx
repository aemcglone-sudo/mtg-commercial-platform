'use client';

import { useEffect, useState } from 'react';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-red-950 text-red-400 border-red-800',
  shop_owner: 'bg-amber-950 text-amber-400 border-amber-800',
  collector: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    search === '' ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-100">Users</h1>
          <p className="text-zinc-500 text-sm mt-1">{users.length} total</p>
        </div>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-64 transition-colors"
        />
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-3.5 text-zinc-200 font-medium">{u.name || <span className="text-zinc-600 italic">—</span>}</td>
                  <td className="px-5 py-3.5 text-zinc-400">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_STYLES[u.role] ?? ROLE_STYLES.collector}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500">
                    {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-zinc-600">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
