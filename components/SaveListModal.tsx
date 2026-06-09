'use client';

import { useState } from 'react';

interface SaveListModalProps {
  cards: Record<string, number>;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}

export default function SaveListModal({ cards, onSave, onCancel }: SaveListModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save list');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-xl font-bold text-zinc-100">Save as List</h2>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">List Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Red Creatures, Combo Pieces"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            disabled={saving}
          />
        </div>

        <div className="text-sm text-zinc-500">
          {Object.keys(cards).length} cards • {Object.values(cards).reduce((a, b) => a + b, 0)} total
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save List'}
          </button>
        </div>
      </div>
    </div>
  );
}
