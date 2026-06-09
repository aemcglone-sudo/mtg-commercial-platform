'use client';

import { useState } from 'react';
import type { CollectionCardData } from './CollectionBrowser';

export interface DeckSummary {
  id: string;
  name: string;
}

interface Props {
  card: CollectionCardData;
  onClose: () => void;
  decks?: DeckSummary[];
}

function getCardUsageExplanation(card: CollectionCardData): string {
  const type = (card.typeLine || '').toLowerCase();
  const oracle = (card.oracleText || '').toLowerCase();

  // Land
  if (type.includes('land')) {
    return 'Taps for mana. Why it\'s cool: Ramps you toward bigger spells and colors you need.';
  }

  // Creature
  if (type.includes('creature')) {
    if (oracle.includes('draw')) return 'Deals damage while drawing cards. Why it\'s cool: Card advantage—you\'re attacking AND refueling your hand.';
    if (oracle.includes('counter') || oracle.includes('tutor')) return 'Creature that tutors or counters threats. Why it\'s cool: Double duty—you attack and get value from its ability.';
    if (oracle.includes('token')) return 'Creates creature tokens. Why it\'s cool: Builds a wide board to attack with multiple threats.';
    return 'Attacks and blocks. Why it\'s cool: Your main offense and defense on the board.';
  }

  // Instant
  if (type.includes('instant')) {
    if (oracle.includes('counter')) return 'Counters opponent\'s spell. Why it\'s cool: Stops their plan in its tracks—pure control.';
    if (oracle.includes('draw')) return 'Draws cards instantly. Why it\'s cool: You get resources while responding to threats.';
    if (oracle.includes('damage')) return 'Deals damage or removes creatures. Why it\'s cool: Answers threats or chips in the last damage.';
    return 'Responds to anything on opponent\'s turn. Why it\'s cool: You get the last word and surprise factor.';
  }

  // Sorcery
  if (type.includes('sorcery')) {
    if (oracle.includes('draw')) return 'Draws cards on your turn. Why it\'s cool: Fuels your hand for future plays.';
    if (oracle.includes('tutor')) return 'Searches your deck for a card. Why it\'s cool: Consistency—you always find what you need.';
    if (oracle.includes('destroy') || oracle.includes('sacrifice')) return 'Removes threats or sacrifices creatures. Why it\'s cool: Clears the way or converts creatures into value.';
    return 'Powerful one-time effect. Why it\'s cool: Big impact on your turn—plan around the timing.';
  }

  // Enchantment
  if (type.includes('enchantment')) {
    if (oracle.includes('aura')) return 'Enchants a creature or land. Why it\'s cool: Boosts what you control or weakens opponents\' threats.';
    return 'Persistent effect that works every turn. Why it\'s cool: Generates value that stacks over time.';
  }

  // Artifact
  if (type.includes('artifact')) {
    if (oracle.includes('mana')) return 'Generates mana. Why it\'s cool: Accelerates your curve—more spells, faster.';
    if (oracle.includes('draw')) return 'Draws cards for you. Why it\'s cool: Colorless card advantage that works in any deck.';
    return 'Provides utility. Why it\'s cool: Works with any deck strategy.';
  }

  // Planeswalker
  if (type.includes('planeswalker')) {
    return 'Repeatable abilities each turn. Why it\'s cool: Incremental advantage that is hard to ignore—opponents must deal with it.';
  }

  // Default
  return 'Fits your deck strategy. Why it\'s cool: Synergizes with the rest of your cards for a cohesive plan.';
}

export default function CardPreviewModal({ card, onClose, decks = [] }: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(card.quantity);
  const [editCollectionType, setEditCollectionType] = useState<'paper' | 'arena'>(card.collectionType ?? 'paper');
  const [saving, setSaving] = useState(false);

  const handleAddCardToDeck = async () => {
    if (!selectedDeckId) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/decks/${selectedDeckId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addCards: [{ name: card.name, quantity }],
        }),
      });

      if (!res.ok) throw new Error('Failed to add card to deck');

      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2000);
      setQuantity(1);
      setSelectedDeckId('');
    } catch (err) {
      console.error('Error adding card to deck:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleSaveCollectionChanges = async () => {
    setSaving(true);
    try {
      // Update collection type if changed
      if (editCollectionType !== (card.collectionType ?? 'paper')) {
        const res = await fetch('/api/card/update-collection', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: card.name, collectionType: editCollectionType }),
        });
        if (!res.ok) throw new Error('Failed to update collection type');
      }

      // Update quantity if changed
      if (editQuantity !== card.quantity) {
        const res = await fetch('/api/card/update-quantity', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: card.name, quantity: editQuantity }),
        });
        if (!res.ok) throw new Error('Failed to update quantity');
      }

      setIsEditing(false);
    } catch (err) {
      console.error('Error saving changes:', err);
      alert(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-6 p-6">
          {/* Card Image */}
          {card.imageUrl && (
            <div className="shrink-0">
              <img
                src={card.imageUrl}
                alt={card.name}
                className="w-48 rounded-lg border border-zinc-700 shadow-lg"
              />
            </div>
          )}

          {/* Card Details */}
          <div className="flex-1 space-y-4">
            {/* Header */}
            <div>
              <h2 className="text-3xl font-bold text-zinc-100">{card.name}</h2>
              <p className="text-zinc-500 text-sm mt-1">{card.setName}</p>
            </div>

            {/* Type Line */}
            {card.typeLine && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Type</p>
                <p className="text-sm text-zinc-300">{card.typeLine}</p>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* CMC */}
              {card.cmc !== null && (
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">CMC</p>
                  <p className="text-lg font-semibold text-zinc-100">{card.cmc}</p>
                </div>
              )}

              {/* Rarity */}
              {card.rarity && (
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Rarity</p>
                  <p className="text-lg font-semibold text-zinc-100 capitalize">{card.rarity}</p>
                </div>
              )}

              {/* Colors */}
              {card.colors && card.colors.length > 0 && (
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Colors</p>
                  <p className="text-sm text-zinc-100">{card.colors.join(', ')}</p>
                </div>
              )}

              {/* Price */}
              {card.priceUsd !== null && card.priceUsd > 0 && (
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Price</p>
                  <p className="text-lg font-semibold text-amber-400">${card.priceUsd.toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Card Text */}
            {card.oracleText && (
              <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
                <p className="text-xs text-zinc-500 font-medium">Card Text</p>
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {card.oracleText}
                </p>
              </div>
            )}

            {/* How to Use */}
            <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-300 font-medium mb-2">How to Use</p>
              <p className="text-sm text-green-200">
                {getCardUsageExplanation(card)}
              </p>
            </div>

            {/* Add to Deck */}
            {decks.length > 0 && (
              <div className="bg-purple-900/30 border border-purple-800 rounded-lg p-3 space-y-2">
                <p className="text-xs text-purple-300 font-medium">Add to Deck</p>
                <div className="flex gap-2">
                  <select
                    aria-label="Select deck"
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100"
                  >
                    <option value="">Select a deck...</option>
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    aria-label="Quantity"
                    min="1"
                    max="4"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
                    className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 text-center"
                  />
                  <button
                    type="button"
                    onClick={handleAddCardToDeck}
                    disabled={!selectedDeckId || adding}
                    className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-600 text-sm font-semibold text-white transition-colors"
                  >
                    {adding ? 'Adding...' : 'Add'}
                  </button>
                </div>
                {addSuccess && (
                  <p className="text-xs text-purple-300">✓ Added to deck</p>
                )}
              </div>
            )}

            {/* Collection Info */}
            <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs text-blue-300 font-medium">Your Collection</p>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-xs px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-blue-100 transition-colors"
                  >
                    ✎ Edit
                  </button>
                )}
              </div>

              {!isEditing ? (
                <>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Quantity Owned</p>
                      <p className="text-xl font-bold text-zinc-100">×{card.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Total Value</p>
                      <p className="text-xl font-bold text-amber-400">
                        ${(card.quantity * (card.priceUsd ?? 0)).toFixed(2)}
                      </p>
                    </div>
                    {card.collectionType && (
                      <div className="ml-auto">
                        <p className="text-xs text-zinc-500">Type</p>
                        <p className="text-sm font-semibold">
                          {card.collectionType === 'paper' ? '📄 Paper' : '⚡ Arena'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="edit-quantity" className="text-xs text-zinc-500">Quantity</label>
                    <input
                      id="edit-quantity"
                      type="number"
                      min="0"
                      max="999"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Collection Type</label>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setEditCollectionType('paper')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          editCollectionType === 'paper'
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        📄 Paper
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCollectionType('arena')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          editCollectionType === 'arena'
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        ⚡ Arena
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditQuantity(card.quantity);
                        setEditCollectionType(card.collectionType ?? 'paper');
                      }}
                      disabled={saving}
                      className="flex-1 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-600 text-sm transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCollectionChanges}
                      disabled={saving}
                      className="flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Artist */}
            {card.artist && (
              <div className="text-xs text-zinc-600 text-right pt-2 border-t border-zinc-800">
                Illustrated by {card.artist}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                Close
              </button>
              {card.scryfallUri && (
                <a
                  href={card.scryfallUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors text-center"
                >
                  View on Scryfall →
                </a>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
