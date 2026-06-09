'use client';

import { useState } from 'react';

interface SaveDeckModalProps {
  isOpen: boolean;
  cards: Record<string, number>;
  onSave: (name: string, format: string) => Promise<void>;
  onClose: () => void;
}

const FORMATS = ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Commander', 'Casual'];

export default function SaveDeckModal({ isOpen, cards, onSave, onClose }: SaveDeckModalProps) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('Commander');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const cardCount = Object.values(cards).reduce((a, b) => a + b, 0);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name, format);
      setName('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-xl font-semibold text-zinc-100">Save Deck</h2>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Deck Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="Enter deck name…"
            autoFocus
            disabled={saving}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            disabled={saving}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          >
            {FORMATS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="text-sm text-zinc-400">
          {cardCount} cards in deck
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-400 text-black font-semibold hover:bg-amber-300 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Deck'}
          </button>
        </div>
      </div>
    </div>
  );
}
