'use client';

import { useState, useEffect } from 'react';
import type { CollectionCardData } from './CollectionBrowser';

export interface DeckSummary {
  id: string;
  name: string;
}

interface CardDetailModalProps {
  cardName: string | null;
  onClose: () => void;
  collectionCard?: CollectionCardData | null;
  decks?: DeckSummary[];
  onCollectionChange?: () => void;
}

interface ScryfallCard {
  name: string;
  image_uris?: { normal: string; large: string };
  card_faces?: Array<{ name: string; image_uris?: { normal: string; large: string }; oracle_text?: string; mana_cost?: string }>;
  type_line: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc: number;
  rarity: string;
  set_name: string;
  scryfall_uri: string;
  prices: { usd: string | null; usd_foil: string | null; eur: string | null; eur_foil: string | null; tix: string | null };
  purchase_uris?: { tcgplayer?: string; cardmarket?: string; cardhoarder?: string };
  related_uris?: { tcgplayer_infinite_articles?: string; tcgplayer_infinite_decks?: string; edhrec?: string; mtgtop8?: string; cubecobra?: string };
}

export default function CardDetailModal({ cardName, onClose, collectionCard, decks = [], onCollectionChange }: CardDetailModalProps) {
  const [scryfallCard, setScryfallCard] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Collection editing state
  const [editQty, setEditQty] = useState(collectionCard?.quantity ?? 1);
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [savingQty, setSavingQty] = useState(false);
  const [displayQty, setDisplayQty] = useState(collectionCard?.quantity ?? 0);

  // Add to collection state
  const [addQty, setAddQty] = useState(1);
  const [addType, setAddType] = useState<'paper' | 'arena'>('paper');
  const [adding, setAdding] = useState(false);
  const [addDone, setAddDone] = useState(false);

  // Add to deck state
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [deckQty, setDeckQty] = useState(1);
  const [addingToDeck, setAddingToDeck] = useState(false);
  const [addedToDeck, setAddedToDeck] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!cardName) return;
    setLoading(true);
    setError('');
    setScryfallCard(null);
    setAddDone(false);
    setIsEditingQty(false);
    setDisplayQty(collectionCard?.quantity ?? 0);
    setEditQty(collectionCard?.quantity ?? 1);
    fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`)
      .then(r => r.json())
      .then(d => { if (d.object === 'error') setError('Card not found'); else setScryfallCard(d); })
      .catch(() => setError('Failed to load card'))
      .finally(() => setLoading(false));
  }, [cardName]);

  if (!cardName) return null;

  const isInCollection = !!collectionCard && !addDone;

  const imageUrl =
    scryfallCard?.image_uris?.large ||
    scryfallCard?.image_uris?.normal ||
    scryfallCard?.card_faces?.[0]?.image_uris?.large ||
    scryfallCard?.card_faces?.[0]?.image_uris?.normal ||
    collectionCard?.imageUrl;

  const oracleText = scryfallCard?.oracle_text ||
    scryfallCard?.card_faces?.map(f => f.oracle_text).filter(Boolean).join('\n\n—\n\n');
  const manaCost = scryfallCard?.mana_cost || scryfallCard?.card_faces?.[0]?.mana_cost;

  // Toolbox links
  const toolboxLinks: Array<{ label: string; url: string; icon: string }> = [];
  if (scryfallCard) {
    const enc = encodeURIComponent(cardName);
    if (scryfallCard.related_uris?.tcgplayer_infinite_articles)
      toolboxLinks.push({ label: 'TCGPlayer articles', url: scryfallCard.related_uris.tcgplayer_infinite_articles, icon: '📰' });
    if (scryfallCard.related_uris?.tcgplayer_infinite_decks)
      toolboxLinks.push({ label: 'TCGPlayer decks', url: scryfallCard.related_uris.tcgplayer_infinite_decks, icon: '🃏' });
    if (scryfallCard.related_uris?.edhrec)
      toolboxLinks.push({ label: 'EDHREC analysis', url: scryfallCard.related_uris.edhrec, icon: '👑' });
    toolboxLinks.push({ label: 'MTGTop8 search', url: `https://www.mtgtop8.com/search?MD_check=1&SB_check=1&cards=${enc}`, icon: '🏆' });
    toolboxLinks.push({ label: 'Moxfield decks', url: `https://www.moxfield.com/search?q=${enc}`, icon: '✦' });
    if (scryfallCard.related_uris?.cubecobra)
      toolboxLinks.push({ label: 'Cube Cobra stats', url: scryfallCard.related_uris.cubecobra, icon: '🎲' });
    toolboxLinks.push({ label: 'Open on Scryfall', url: scryfallCard.scryfall_uri, icon: '🔮' });
  }

  // Buy links
  const buyLinks: Array<{ label: string; url: string; price: string | null; icon: string }> = [];
  if (scryfallCard?.purchase_uris) {
    const p = scryfallCard.purchase_uris;
    const pr = scryfallCard.prices;
    if (p.tcgplayer) {
      buyLinks.push({ label: 'Buy on TCGPlayer', url: p.tcgplayer, price: pr.usd ? `$${pr.usd}` : null, icon: '🛒' });
      if (pr.usd_foil) buyLinks.push({ label: 'Buy foil on TCGPlayer', url: p.tcgplayer, price: `$${pr.usd_foil}`, icon: '✨' });
    }
    if (p.cardmarket) {
      buyLinks.push({ label: 'Buy on Cardmarket', url: p.cardmarket, price: pr.eur ? `€${pr.eur}` : null, icon: '🛒' });
      if (pr.eur_foil) buyLinks.push({ label: 'Buy foil on Cardmarket', url: p.cardmarket, price: `€${pr.eur_foil}`, icon: '✨' });
    }
    if (p.cardhoarder && pr.tix)
      buyLinks.push({ label: 'Buy on Cardhoarder (MTGO)', url: p.cardhoarder, price: `${pr.tix} tix`, icon: '💻' });
  }

  async function handleAddToCollection() {
    setAdding(true);
    try {
      const res = await fetch('/api/collection/card', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cardName, quantity: addQty, collectionType: addType }),
      });
      if (res.ok) {
        setAddDone(true);
        setDisplayQty(addQty);
        onCollectionChange?.();
      }
    } catch { /* ignore */ }
    finally { setAdding(false); }
  }

  async function handleSaveQty() {
    setSavingQty(true);
    try {
      const res = await fetch('/api/card/update-quantity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cardName, quantity: editQty }),
      });
      if (res.ok) {
        setDisplayQty(editQty);
        setIsEditingQty(false);
        onCollectionChange?.();
      }
    } catch { /* ignore */ }
    finally { setSavingQty(false); }
  }

  async function handleAddToDeck() {
    if (!selectedDeckId) return;
    setAddingToDeck(true);
    try {
      const res = await fetch(`/api/decks/${selectedDeckId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addCards: [{ name: cardName, quantity: deckQty }] }),
      });
      if (res.ok) {
        setAddedToDeck(true);
        setTimeout(() => { setAddedToDeck(false); setSelectedDeckId(''); setDeckQty(1); }, 2000);
      }
    } catch { /* ignore */ }
    finally { setAddingToDeck(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-100">{cardName}</h2>
            {scryfallCard && (
              <p className="text-xs text-zinc-500">{scryfallCard.set_name} · {scryfallCard.rarity.charAt(0).toUpperCase() + scryfallCard.rarity.slice(1)}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-200 transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="max-h-[82vh] overflow-y-auto">
          {loading && <div className="p-8 text-center text-sm text-zinc-500">Loading card data…</div>}
          {error && <div className="p-4 text-sm text-red-400">{error}</div>}

          {!loading && !error && (
            <div className="flex flex-col md:flex-row">

              {/* Left column */}
              <div className="md:w-56 shrink-0 p-4 space-y-3 border-b md:border-b-0 md:border-r border-zinc-800">
                {imageUrl && (
                  <img src={imageUrl} alt={cardName} className="w-full rounded-lg border border-zinc-700" />
                )}

                {/* Collection status */}
                {isInCollection ? (
                  <div className="rounded-lg bg-green-900/30 border border-green-800 p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-green-300 font-semibold">✓ In collection</span>
                      {!isEditingQty && (
                        <button type="button" onClick={() => setIsEditingQty(true)} className="text-zinc-500 hover:text-zinc-300 transition-colors">✎</button>
                      )}
                    </div>
                    {!isEditingQty ? (
                      <div className="space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Owned</span>
                          <span className="text-zinc-200 font-semibold">{displayQty}x</span>
                        </div>
                        {collectionCard?.priceUsd && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Value</span>
                            <span className="text-amber-400 font-semibold">${(collectionCard.priceUsd * displayQty).toFixed(2)}</span>
                          </div>
                        )}
                        {collectionCard?.collectionType && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Format</span>
                            <span className="text-zinc-400 capitalize">{collectionCard.collectionType}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500">Qty</span>
                          <input
                            aria-label="Quantity owned"
                            type="number" min="0" max="999"
                            value={editQty}
                            onChange={e => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-center text-xs"
                          />
                        </div>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setIsEditingQty(false)} className="flex-1 px-2 py-1 rounded text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-600 transition-colors">Cancel</button>
                          <button type="button" onClick={handleSaveQty} disabled={savingQty} className="flex-1 px-2 py-1 rounded text-xs font-semibold bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 transition-colors">
                            {savingQty ? '…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-2.5 text-xs space-y-2">
                    {addDone ? (
                      <p className="text-green-400 font-semibold text-center">✓ Added to collection!</p>
                    ) : (
                      <>
                        <p className="text-zinc-400 font-semibold">Add to collection</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500 shrink-0">Qty</span>
                          <input
                            aria-label="Quantity to add"
                            type="number" min="1" max="99"
                            value={addQty}
                            onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-zinc-100 text-center text-xs"
                          />
                          <select
                            aria-label="Collection type"
                            value={addType}
                            onChange={e => setAddType(e.target.value as 'paper' | 'arena')}
                            className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-1 py-1 text-zinc-100 text-xs"
                          >
                            <option value="paper">📄 Paper</option>
                            <option value="arena">⚡ Arena</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddToCollection}
                          disabled={adding}
                          className="w-full py-1.5 rounded text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 transition-colors"
                        >
                          {adding ? 'Adding…' : '+ Add to Collection'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Card stats */}
                {scryfallCard && (
                  <div className="space-y-1.5 text-xs">
                    {manaCost && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Mana</span>
                        <span className="text-zinc-300 font-mono">{manaCost}</span>
                      </div>
                    )}
                    {scryfallCard.cmc != null && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">CMC</span>
                        <span className="text-zinc-300">{scryfallCard.cmc}</span>
                      </div>
                    )}
                    {scryfallCard.type_line && (
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500 shrink-0">Type</span>
                        <span className="text-zinc-300 text-right">{scryfallCard.type_line}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-zinc-800">
                      <span className="text-zinc-500">Price</span>
                      <span className={scryfallCard.prices.usd ? 'text-amber-400 font-semibold' : 'text-zinc-600'}>
                        {scryfallCard.prices.usd ? `$${scryfallCard.prices.usd}` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Foil</span>
                      <span className={scryfallCard.prices.usd_foil ? 'text-purple-400 font-semibold' : 'text-zinc-600'}>
                        {scryfallCard.prices.usd_foil ? `$${scryfallCard.prices.usd_foil}` : '—'}
                      </span>
                    </div>
                    {scryfallCard.prices.tix && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">MTGO</span>
                        <span className="text-blue-400">{scryfallCard.prices.tix} tix</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="flex-1 p-4 space-y-4 min-w-0">

                {/* Oracle text */}
                {oracleText && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Card Text</p>
                    <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap bg-zinc-800/50 rounded-lg p-3 border border-zinc-800">
                      {oracleText}
                    </p>
                  </div>
                )}

                {/* Add to deck */}
                {decks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Add to Deck</p>
                    <div className="flex gap-1.5">
                      <select
                        aria-label="Select deck"
                        value={selectedDeckId}
                        onChange={e => setSelectedDeckId(e.target.value)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 min-w-0"
                      >
                        <option value="">Select a deck…</option>
                        {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <input
                        aria-label="Quantity to add to deck"
                        type="number" min="1" max="99"
                        value={deckQty}
                        onChange={e => setDeckQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-100 text-center"
                      />
                      <button
                        type="button"
                        onClick={handleAddToDeck}
                        disabled={!selectedDeckId || addingToDeck}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-40 transition-colors"
                      >
                        {addedToDeck ? '✓' : addingToDeck ? '…' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Toolbox */}
                {toolboxLinks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Toolbox</p>
                    <div className="grid grid-cols-1 gap-1">
                      {toolboxLinks.map(link => (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
                        >
                          <span>{link.icon}</span>
                          <span>{link.label}</span>
                          <span className="ml-auto text-zinc-600 text-xs">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buy */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Buy This Card</p>
                  {buyLinks.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1">
                      {buyLinks.map(link => (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
                        >
                          <span>{link.icon}</span>
                          <span>{link.label}</span>
                          {link.price && <span className="ml-auto text-amber-400 font-semibold text-xs">{link.price}</span>}
                        </a>
                      ))}
                    </div>
                  ) : scryfallCard ? (
                    <p className="text-xs text-zinc-600 px-1">No physical purchase options — this may be a digital-only card.</p>
                  ) : null}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
