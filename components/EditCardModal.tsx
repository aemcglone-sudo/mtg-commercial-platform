'use client';

import { useState, useEffect } from 'react';

interface Props {
  card: {
    name: string;
    collectionType: 'paper' | 'arena';
  };
  onSave: (collectionType: 'paper' | 'arena') => Promise<void>;
  onClose: () => void;
}

export default function EditCardModal({ card, onSave, onClose }: Props) {
  const [collectionType, setCollectionType] = useState<'paper' | 'arena'>(card.collectionType);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync local state when card prop changes (including after save)
  useEffect(() => {
    setCollectionType(card.collectionType);
  }, [card.collectionType]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(collectionType);
      setSaved(true);
      setTimeout(() => onClose(), 800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-100 text-sm">Edit Card</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-zinc-400">{card.name}</p>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-400">Collection Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCollectionType('paper')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  collectionType === 'paper'
                    ? 'bg-amber-400 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                📄 Paper
              </button>
              <button
                type="button"
                onClick={() => setCollectionType('arena')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  collectionType === 'arena'
                    ? 'bg-amber-400 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                ⚡ Arena
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-600 text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || saved || collectionType === card.collectionType}
              className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40'
              }`}
            >
              {saving ? (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  Saving…
                </span>
              ) : saved ? (
                '✓ Saved!'
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
