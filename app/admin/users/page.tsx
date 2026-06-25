'use client';

import { useEffect, useState, FormEvent } from 'react';

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
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'collector' });
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    search === '' ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError('');
    setAddSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setAddError(data.error ?? 'Failed to create user.'); return; }
      setAddForm({ name: '', email: '', password: '', role: 'collector' });
      setShowAdd(false);
      load();
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Remove ${user.name || user.email}? This permanently deletes their account and all associated data.`)) return;
    setDeletingId(user.id);
    try {
      await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-100">Users</h1>
          <p className="text-zinc-500 text-sm mt-1">{users.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-56 transition-colors"
          />
          <button
            type="button"
            onClick={() => { setShowAdd(v => !v); setAddError(''); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-400 text-black hover:bg-amber-300 transition-colors"
          >
            + Add User
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4 max-w-md">
          <h2 className="text-sm font-semibold text-zinc-200">New user</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 uppercase tracking-wide">Name</label>
              <input type="text" placeholder="Full name" value={addForm.name}
                onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 uppercase tracking-wide">Role</label>
              <select title="Role" value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors">
                <option value="collector">Collector</option>
                <option value="shop_owner">Shop Owner</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">Email <span className="text-red-400">*</span></label>
            <input type="email" required placeholder="user@example.com" value={addForm.email}
              onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">Password <span className="text-red-400">*</span></label>
            <input type="password" required placeholder="8+ characters" value={addForm.password}
              onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors" />
          </div>
          {addError && <p className="text-red-400 text-sm">{addError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={addSaving}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-50 transition-colors">
              {addSaving ? 'Creating…' : 'Create User'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

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
                <th className="px-5 py-3" scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-zinc-800/50 transition-colors group">
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
                  <td className="px-5 py-3.5 text-right">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        type="button"
                        className="opacity-0 group-hover:opacity-100 text-xs text-zinc-600 hover:text-red-400 disabled:opacity-30 transition-all"
                      >
                        {deletingId === u.id ? 'Removing…' : 'Remove'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-600">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
