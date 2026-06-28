'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { CardNameLink } from '@/components/CardNameLink';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { computeBuyPrice } from '@/lib/buy-pricing';
import type { BuyMatrix, MarginTargets, BuyRule } from '@/lib/buy-pricing';

// ─── Types ────────────────────────────────────────────────────────────────

type TopTab = 'sale' | 'purchase';
type SaleSub = 'rules' | 'matrix' | 'floors' | 'wizard';
type PurchaseSub = 'lookup' | 'history';

const SALE_SUBS: { key: SaleSub; label: string }[] = [
  { key: 'rules',  label: 'Rules' },
  { key: 'matrix', label: 'Condition Matrix' },
  { key: 'floors', label: 'Floor Prices' },
  { key: 'wizard', label: 'Reprice Wizard' },
];

// Keep Tab as alias so sub-components that use it still compile
type Tab = SaleSub;

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;
const RARITIES = ['C', 'U', 'R', 'M'] as const;
const RARITY_LABELS: Record<string, string> = { C: 'Common', U: 'Uncommon', R: 'Rare', M: 'Mythic Rare' };

interface PricingRule {
  id: string;
  priority: number;
  scopeConditions: string[];
  scopeRarities: string[];
  scopeSetCodes: string[];
  scopePriceMinCents: number | null;
  scopePriceMaxCents: number | null;
  strategy: 'market_pct' | 'flat' | 'condition_matrix_pct';
  strategyValue: number | null;
  strategyDirection: 'above' | 'below' | null;
  floorPriceCents: number | null;
  isActive: boolean;
}

interface WizardPreviewItem {
  id: string;
  cardName: string;
  condition: string;
  currentCents: number;
  newCents: number;
  hitFloor: boolean;
}

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  type_line: string;
  rarity: string;
  image_uris?: { small?: string; normal?: string };
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>;
  prices: { usd?: string | null; usd_foil?: string | null };
}

interface OfferItem {
  scryfallId: string;
  cardName: string;
  setCode: string;
  condition: string;
  foil: boolean;
  qty: number;
  tcgCents: number;
  buyPriceCents: number;
  imageUrl: string | null;
  rarity: string | null;
  typeLine: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtDelta = (delta: number) => {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}$${(Math.abs(delta) / 100).toFixed(2)}`;
};

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${type === 'success' ? 'bg-green-800 text-green-100 border border-green-600' : 'bg-red-900 text-red-100 border border-red-700'}`}>
      {message}
    </div>
  );
}

// ─── Offer Builder Drawer ─────────────────────────────────────────────────

function OfferBuilder({
  items,
  onUpdateItem,
  onRemoveItem,
  onClear,
  shopName,
}: {
  items: OfferItem[];
  onUpdateItem: (idx: number, patch: Partial<OfferItem>) => void;
  onRemoveItem: (idx: number) => void;
  onClear: () => void;
  shopName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [roundTo, setRoundTo] = useState(5);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [sellerContact, setSellerContact] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => { if (items.length > 0) setExpanded(true); }, [items.length]);

  const total = items.reduce((sum, i) => sum + i.buyPriceCents * i.qty, 0);
  const rounded = Math.ceil(total / (roundTo * 100)) * (roundTo * 100);

  async function handleShare() {
    const res = await fetch('/api/shops/offers/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, totalCents: total, roundedTotalCents: rounded }),
    });
    if (res.ok) {
      const { id } = await res.json() as { id: string };
      const url = `${window.location.origin}/shop/offer/${id}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      window.open(url, '_blank');
      setToast({ message: 'Share link copied to clipboard', type: 'success' });
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch('/api/shops/offers/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, totalPaidCents: rounded, sellerName, sellerContact, notes }),
      });
      if (res.ok) {
        setToast({ message: 'Purchase confirmed and cards added to inventory', type: 'success' });
        setShowConfirm(false);
        onClear();
      } else {
        setToast({ message: 'Failed to confirm purchase', type: 'error' });
      }
    } finally { setConfirming(false); }
  }

  if (items.length === 0) return null;

  return (
    <>
      {/* Print-only offer sheet */}
      <div className="hidden print:block p-8 font-sans text-black">
        <div className="text-2xl font-bold mb-1">{shopName}</div>
        <div className="text-sm text-gray-500 mb-6">Card Buylist Offer · {new Date().toLocaleDateString()}</div>
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 pr-4">Card</th>
              <th className="text-left py-2 pr-4">Set</th>
              <th className="text-left py-2 pr-4">Cond</th>
              <th className="text-center py-2 pr-4">Qty</th>
              <th className="text-right py-2">Buy Price</th>
              <th className="text-right py-2 pl-4">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1.5 pr-4"><CardNameLink name={item.cardName} />{item.foil ? ' (Foil)' : ''}</td>
                <td className="py-1.5 pr-4 text-gray-500">{item.setCode.toUpperCase()}</td>
                <td className="py-1.5 pr-4">{item.condition}</td>
                <td className="py-1.5 pr-4 text-center">{item.qty}</td>
                <td className="py-1.5 text-right">{fmt(item.buyPriceCents)}</td>
                <td className="py-1.5 pl-4 text-right font-medium">{fmt(item.buyPriceCents * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right text-lg font-bold">Total Offer: {fmt(rounded)}</div>
        <div className="text-xs text-gray-400 mt-4">Offer valid 24 hours. Prices based on TCGPlayer market as of today.</div>
      </div>

      {/* Drawer */}
      <div className="print:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-700 bg-zinc-950 shadow-2xl">
        {/* Collapsed bar */}
        <div
          className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-zinc-900/50 transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-200">
              🛒 Current Offer · {items.reduce((s, i) => s + i.qty, 0)} cards · <span className="text-amber-400 font-bold">{fmt(rounded)}</span>
            </span>
            {items.length > 0 && (
              <span className="text-xs text-zinc-500">{items.length} line{items.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={e => { e.stopPropagation(); onClear(); }}
              className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Clear</button>
            <span className="text-zinc-600 text-sm">{expanded ? '▼' : '▲'}</span>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-zinc-800 max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800 sticky top-0">
                  <th className="text-left px-4 py-2 text-zinc-500 font-medium">Card</th>
                  <th className="text-center px-2 py-2 text-zinc-500 font-medium w-16">Cond</th>
                  <th className="text-center px-2 py-2 text-zinc-500 font-medium w-16">Foil</th>
                  <th className="text-center px-2 py-2 text-zinc-500 font-medium w-16">Qty</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium w-24">TCG Mkt</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium w-24">Buy Price</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium w-24">Subtotal</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/30">
                    <td className="px-4 py-2 text-zinc-200 max-w-48">
                      <span className="block truncate"><CardNameLink name={item.cardName} /></span>
                      <span className="text-zinc-600 text-[10px]">{item.setCode.toUpperCase()}</span>
                    </td>
                    <td className="px-2 py-2 text-center text-zinc-400">{item.condition}</td>
                    <td className="px-2 py-2 text-center text-zinc-500">{item.foil ? '✓' : '—'}</td>
                    <td className="px-2 py-2 text-center">
                      <input type="number" min={1} value={item.qty}
                        onChange={e => onUpdateItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-center text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-zinc-500 tabular-nums">{fmt(item.tcgCents)}</td>
                    <td className="px-2 py-2 text-right">
                      <input type="number" min={0} step={0.01}
                        value={(item.buyPriceCents / 100).toFixed(2)}
                        onChange={e => onUpdateItem(idx, { buyPriceCents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                        className="w-20 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-right text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-zinc-300 tabular-nums font-medium">{fmt(item.buyPriceCents * item.qty)}</td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => onRemoveItem(idx)}
                        className="text-zinc-700 hover:text-red-400 transition-colors">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>Subtotal: <span className="text-zinc-200 font-medium">{fmt(total)}</span></span>
                <span>Round up to nearest</span>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">$</span>
                  <input type="number" min={1} step={1} value={roundTo}
                    onChange={e => setRoundTo(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <span>→ <span className="text-amber-400 font-bold">{fmt(rounded)}</span></span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs hover:text-zinc-200 transition-colors">
                  Print
                </button>
                <button type="button" onClick={handleShare}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs hover:text-zinc-200 transition-colors">
                  Share Link
                </button>
                <button type="button" onClick={() => setShowConfirm(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition-colors">
                  Confirm Purchase
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100">Confirm Purchase</h3>
              <button type="button" onClick={() => setShowConfirm(false)} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Seller name (optional)</label>
                <input type="text" value={sellerName} onChange={e => setSellerName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Contact / email (optional)</label>
                <input type="text" value={sellerContact} onChange={e => setSellerContact(e.target.value)}
                  placeholder="e.g. john@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Any notes about this purchase…"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500 resize-none" />
              </div>
              <div className="bg-zinc-800 rounded-lg px-3 py-2 text-sm">
                <span className="text-zinc-400">Total paid: </span>
                <span className="text-amber-400 font-bold">{fmt(rounded)}</span>
              </div>
              <p className="text-xs text-zinc-500">Cards will be automatically added to your inventory at a target sell price.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={handleConfirm} disabled={confirming}
                className="flex-1 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60">
                {confirming ? 'Confirming…' : 'Confirm & Add to Inventory'}
              </button>
              <button type="button" onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </>
  );
}

// ─── Buy Tab ──────────────────────────────────────────────────────────────

type BuySettingsSubTab = 'matrix' | 'targets' | 'rules';

function BuyTab() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [buyPriceData, setBuyPriceData] = useState<{ tcgCents: number | null; foilCents: number | null; trendPct7d: number | null; trendDirection: 'up' | 'down' | 'stable' } | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [showFoil, setShowFoil] = useState(false);
  const [buyMatrix, setBuyMatrix] = useState<BuyMatrix>({ NM: 60, LP: 51, MP: 42, HP: 30, DMG: 15 });
  const [marginTargets, setMarginTargets] = useState<MarginTargets>({ under_1: 60, '1_to_10': 45, '10_to_50': 40, over_50: 35 });
  const [buyRules, setBuyRules] = useState<BuyRule[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [settingsTab, setSettingsTab] = useState<BuySettingsSubTab>('matrix');
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [editingBuyRule, setEditingBuyRule] = useState<Partial<BuyRule> | null | false>(false);
  const [offerItems, setOfferItems] = useState<OfferItem[]>([]);
  const [shopName, setShopName] = useState('Shop');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/shops/pricing/buy-matrix')
      .then(r => r.json())
      .then((d: { buyMatrix: BuyMatrix; marginTargets: MarginTargets }) => {
        if (d.buyMatrix) setBuyMatrix(d.buyMatrix);
        if (d.marginTargets) setMarginTargets(d.marginTargets);
      })
      .catch(() => {});
    fetch('/api/shops/pricing/buy-rules')
      .then(r => r.json())
      .then((d: { rules: BuyRule[] }) => { if (d.rules) setBuyRules(d.rules); })
      .catch(() => {});
    fetch('/api/shops/me')
      .then(r => r.json())
      .then((d: { shop?: { name: string } }) => { if (d.shop?.name) setShopName(d.shop.name); })
      .catch(() => {});
  }, []);

  // Autocomplete
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((d: { data?: string[] }) => setSuggestions((d.data ?? []).slice(0, 8)))
        .catch(() => {});
    }, 250);
  }, [query]);

  // Click outside to close suggestions
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function selectCard(name: string) {
    setQuery(name);
    setShowSuggestions(false);
    setLoadingCard(true);
    try {
      const [cardRes, priceRes] = await Promise.all([
        fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`),
        (async () => null)(), // placeholder
      ]);
      const card = await cardRes.json() as ScryfallCard;
      setSelectedCard(card);

      const priceParams = new URLSearchParams({ scryfallId: card.id });
      if (card.prices?.usd) priceParams.set('usd', card.prices.usd);
      if (card.prices?.usd_foil) priceParams.set('usdFoil', card.prices.usd_foil);
      const priceData = await fetch(`/api/cards/buy-price?${priceParams}`).then(r => r.json()) as typeof buyPriceData;
      setBuyPriceData(priceData);
      void priceRes;
    } catch { /* ignore */ }
    finally { setLoadingCard(false); }
  }

  function getCardImage(card: ScryfallCard): string | null {
    return card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? null;
  }

  function addToOffer(condition: string, foil: boolean) {
    if (!selectedCard || !buyPriceData) return;
    const tcgCents = foil ? (buyPriceData.foilCents ?? 0) : (buyPriceData.tcgCents ?? 0);
    const { buyPriceCents } = computeBuyPrice(
      tcgCents, condition, selectedCard.rarity, selectedCard.set, buyMatrix, buyRules, buyPriceData.trendPct7d ?? undefined
    );
    setOfferItems(prev => {
      const existing = prev.findIndex(i => i.scryfallId === selectedCard.id && i.condition === condition && i.foil === foil);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], qty: next[existing].qty + 1 };
        return next;
      }
      return [...prev, {
        scryfallId: selectedCard.id,
        cardName: selectedCard.name,
        setCode: selectedCard.set,
        condition,
        foil,
        qty: 1,
        tcgCents,
        buyPriceCents,
        imageUrl: getCardImage(selectedCard),
        rarity: selectedCard.rarity,
        typeLine: selectedCard.type_line,
      }];
    });
  }

  async function saveMatrix() {
    setSavingMatrix(true);
    try {
      await fetch('/api/shops/pricing/buy-matrix', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyMatrix }),
      });
      setToast({ message: 'Buy matrix saved', type: 'success' });
    } finally { setSavingMatrix(false); }
  }

  async function saveTargets() {
    setSavingTargets(true);
    try {
      await fetch('/api/shops/pricing/buy-matrix', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marginTargets }),
      });
      setToast({ message: 'Margin targets saved', type: 'success' });
    } finally { setSavingTargets(false); }
  }

  async function saveBuyRule(rule: Partial<BuyRule>) {
    if (rule.id) {
      await fetch(`/api/shops/pricing/buy-rules/${rule.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
    } else {
      await fetch('/api/shops/pricing/buy-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
    }
    const d = await fetch('/api/shops/pricing/buy-rules').then(r => r.json()) as { rules: BuyRule[] };
    setBuyRules(d.rules ?? []);
    setToast({ message: rule.id ? 'Rule updated' : 'Rule added', type: 'success' });
    setEditingBuyRule(false);
  }

  async function deleteBuyRule(id: string) {
    if (!confirm('Delete this buy rule?')) return;
    await fetch(`/api/shops/pricing/buy-rules/${id}`, { method: 'DELETE' });
    setBuyRules(prev => prev.filter(r => r.id !== id));
  }

  async function moveBuyRule(index: number, dir: -1 | 1) {
    const next = [...buyRules];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBuyRules(next);
    await fetch('/api/shops/pricing/buy-rules/reorder', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(r => r.id) }),
    });
  }

  const trendIcon = buyPriceData?.trendDirection === 'up' ? '↑' : buyPriceData?.trendDirection === 'down' ? '↓' : '→';
  const trendColor = buyPriceData?.trendDirection === 'up' ? 'text-green-400' : buyPriceData?.trendDirection === 'down' ? 'text-red-400' : 'text-zinc-500';

  return (
    <div className="space-y-6 pb-40">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Buy Pricing</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Look up cards and build buylist offers in real time.</p>
        </div>
        <Link href="/shop/pricing?tab=purchase&sub=history" className="text-xs text-zinc-500 hover:text-amber-400 transition-colors">
          Purchase History →
        </Link>
      </div>

      <div className="space-y-6">
        {/* Card Lookup */}
        <div className="space-y-4">
          <div ref={searchRef} className="relative">
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              placeholder="Search for a card…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
                {suggestions.map(name => (
                  <button key={name} type="button"
                    onMouseDown={() => selectCard(name)}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0">
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadingCard && (
            <div className="text-zinc-500 text-sm text-center py-8">Loading…</div>
          )}

          {selectedCard && buyPriceData && !loadingCard && (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              {/* Card header */}
              <div className="flex gap-3 p-3 bg-zinc-900/60">
                {getCardImage(selectedCard) && (
                  <img src={getCardImage(selectedCard)!} alt={selectedCard.name}
                    className="w-14 rounded-md shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-100 text-sm truncate">{selectedCard.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{selectedCard.set_name} · {selectedCard.rarity.charAt(0).toUpperCase() + selectedCard.rarity.slice(1)}</div>
                  <div className="text-xs text-zinc-600 truncate">{selectedCard.type_line}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-zinc-500">
                      TCG: <span className="text-zinc-200 font-medium tabular-nums">{buyPriceData.tcgCents != null ? fmt(buyPriceData.tcgCents) : '—'}</span>
                    </span>
                    {buyPriceData.foilCents != null && (
                      <span className="text-xs text-zinc-500">
                        Foil: <span className="text-zinc-200 font-medium tabular-nums">{fmt(buyPriceData.foilCents)}</span>
                      </span>
                    )}
                    {buyPriceData.trendPct7d != null && (
                      <span className={`text-xs font-medium ${trendColor}`}>
                        {trendIcon} {Math.abs(buyPriceData.trendPct7d).toFixed(0)}% 7d
                      </span>
                    )}
                  </div>
                  {buyPriceData.trendPct7d != null && buyPriceData.trendPct7d < -10 && (
                    <div className="mt-1.5 text-[10px] text-red-400 bg-red-900/20 rounded px-2 py-0.5 inline-block">
                      ⚠ Dropping {Math.abs(buyPriceData.trendPct7d).toFixed(0)}% — consider buying below matrix
                    </div>
                  )}
                </div>
              </div>

              {/* Condition table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800 border-t border-zinc-800">
                    <th className="text-left px-3 py-2 text-zinc-500 font-medium">Condition</th>
                    <th className="text-right px-3 py-2 text-zinc-500 font-medium">TCG Market</th>
                    <th className="text-right px-3 py-2 text-zinc-500 font-medium">Buy Price</th>
                    <th className="text-right px-3 py-2 text-zinc-500 font-medium">Margin</th>
                    <th className="px-3 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {CONDITIONS.map(cond => {
                    const tcg = buyPriceData.tcgCents ?? 0;
                    const { buyPriceCents, marginPct, warnings } = computeBuyPrice(
                      tcg, cond, selectedCard.rarity, selectedCard.set, buyMatrix, buyRules, buyPriceData.trendPct7d ?? undefined
                    );
                    return (
                      <tr key={cond} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20">
                        <td className="px-3 py-2 text-zinc-200 font-medium">
                          {cond}
                          {warnings.length > 0 && <span className="ml-1 text-yellow-500 text-[10px]">⚠</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{tcg > 0 ? fmt(tcg) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-200 font-medium">{tcg > 0 ? fmt(buyPriceCents) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{tcg > 0 ? `${marginPct}%` : '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {tcg > 0 && (
                            <button type="button" onClick={() => addToOffer(cond, false)}
                              className="px-2 py-0.5 rounded text-[10px] bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 transition-colors font-medium">
                              + Add
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {showFoil && buyPriceData.foilCents != null && (
                    <tr className="border-t border-zinc-700 bg-blue-900/10 hover:bg-blue-900/20">
                      <td className="px-3 py-2 text-blue-300 font-medium">NM Foil</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{fmt(buyPriceData.foilCents)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200 font-medium">
                        {fmt(computeBuyPrice(buyPriceData.foilCents, 'NM', selectedCard.rarity, selectedCard.set, buyMatrix, buyRules).buyPriceCents)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {computeBuyPrice(buyPriceData.foilCents, 'NM', selectedCard.rarity, selectedCard.set, buyMatrix, buyRules).marginPct}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => addToOffer('NM', true)}
                          className="px-2 py-0.5 rounded text-[10px] bg-blue-400/20 text-blue-300 hover:bg-blue-400/30 transition-colors font-medium">
                          + Add
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="px-3 py-2 bg-zinc-900/40 border-t border-zinc-800 flex items-center justify-between">
                <button type="button" onClick={() => setShowFoil(f => !f)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
                  {showFoil ? 'Hide foil row' : 'Show foil row'}
                </button>
                <span className="text-[10px] text-zinc-600">
                  NM buy = {buyMatrix.NM}% of TCG
                </span>
              </div>
            </div>
          )}

          {!selectedCard && !loadingCard && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-10 text-center text-zinc-600 text-sm">
              Search for a card above to see buy prices
            </div>
          )}
        </div>

        {/* Buy Settings */}
        <div className="space-y-3">
          <button type="button"
            onClick={() => setSettingsOpen(o => !o)}
            className="flex items-center justify-between w-full text-left px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors">
            <span className="text-sm font-medium text-zinc-200">Buy Settings</span>
            <span className="text-zinc-600 text-xs">{settingsOpen ? '▲ Collapse' : '▼ Expand'}</span>
          </button>

          {settingsOpen && (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              {/* Sub-tabs */}
              <div className="flex border-b border-zinc-800 bg-zinc-900">
                {([
                  { key: 'matrix' as BuySettingsSubTab, label: 'Buy Matrix' },
                  { key: 'targets' as BuySettingsSubTab, label: 'Margin Targets' },
                  { key: 'rules' as BuySettingsSubTab, label: 'Buy Rules' },
                ]).map(t => (
                  <button key={t.key} type="button" onClick={() => setSettingsTab(t.key)}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${settingsTab === t.key ? 'border-amber-500 text-zinc-200' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {settingsTab === 'matrix' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Percentage of TCG market price to pay per condition.</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left py-1.5 text-zinc-500 font-medium text-xs">Condition</th>
                          <th className="text-left py-1.5 text-zinc-500 font-medium text-xs">Description</th>
                          <th className="text-right py-1.5 text-zinc-500 font-medium text-xs">% of TCG</th>
                          <th className="text-right py-1.5 text-zinc-500 font-medium text-xs">Example ($10 NM)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CONDITIONS.map(cond => (
                          <tr key={cond} className="border-b border-zinc-800/50 last:border-0">
                            <td className="py-2 text-zinc-200 text-xs whitespace-nowrap pr-3">
                              {CONDITION_INFO[cond].name}
                              <span className="text-zinc-500 ml-1">({cond})</span>
                            </td>
                            <td className="py-2 text-zinc-500 text-xs pr-3">{CONDITION_INFO[cond].desc}</td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <input type="number" min={0} max={100} step={1}
                                  value={buyMatrix[cond as keyof BuyMatrix] ?? ''}
                                  onChange={e => setBuyMatrix(prev => ({ ...prev, [cond]: Number(e.target.value) }))}
                                  className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-right text-zinc-200 focus:outline-none focus:border-amber-500 text-xs"
                                />
                                <span className="text-zinc-500 text-xs">%</span>
                              </div>
                            </td>
                            <td className="py-2 text-right text-zinc-400 tabular-nums text-xs">
                              {fmt(Math.round(1000 * (buyMatrix[cond as keyof BuyMatrix] ?? 60) / 100))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button type="button" onClick={saveMatrix} disabled={savingMatrix}
                      className="px-4 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition-colors disabled:opacity-60">
                      {savingMatrix ? 'Saving…' : 'Save Matrix'}
                    </button>
                  </div>
                )}

                {settingsTab === 'targets' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Target margin (% of TCG) by card value. Used for reporting — does not override the matrix.</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left py-1.5 text-zinc-500 font-medium text-xs">Card Value</th>
                          <th className="text-right py-1.5 text-zinc-500 font-medium text-xs">Target %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          { key: 'under_1' as keyof MarginTargets, label: 'Under $1' },
                          { key: '1_to_10' as keyof MarginTargets, label: '$1 – $10' },
                          { key: '10_to_50' as keyof MarginTargets, label: '$10 – $50' },
                          { key: 'over_50' as keyof MarginTargets, label: 'Over $50' },
                        ]).map(row => (
                          <tr key={row.key} className="border-b border-zinc-800/50 last:border-0">
                            <td className="py-1.5 text-zinc-300">{row.label}</td>
                            <td className="py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <input type="number" min={0} max={100} step={1}
                                  value={marginTargets[row.key] ?? ''}
                                  onChange={e => setMarginTargets(prev => ({ ...prev, [row.key]: Number(e.target.value) }))}
                                  className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-right text-zinc-200 focus:outline-none focus:border-amber-500 text-xs"
                                />
                                <span className="text-zinc-500 text-xs">%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button type="button" onClick={saveTargets} disabled={savingTargets}
                      className="px-4 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition-colors disabled:opacity-60">
                      {savingTargets ? 'Saving…' : 'Save Targets'}
                    </button>
                  </div>
                )}

                {settingsTab === 'rules' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500">Adjust buy prices by scope. First match wins.</p>
                      <button type="button" onClick={() => setEditingBuyRule({})}
                        className="px-3 py-1 rounded-lg bg-amber-400/20 border border-amber-500/40 text-amber-300 text-xs font-medium hover:bg-amber-400/30 transition-colors">
                        + Add Rule
                      </button>
                    </div>

                    {buyRules.length === 0 && (
                      <div className="py-6 text-center text-zinc-600 text-xs">No buy rules yet.</div>
                    )}

                    {buyRules.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800">
                            <th className="text-left py-1.5 text-zinc-500 font-medium">#</th>
                            <th className="text-left py-1.5 text-zinc-500 font-medium">Scope</th>
                            <th className="text-left py-1.5 text-zinc-500 font-medium">Adjustment</th>
                            <th className="py-1.5 w-20" />
                          </tr>
                        </thead>
                        <tbody>
                          {buyRules.map((rule, i) => {
                            const scope = [
                              rule.scopeConditions.length ? rule.scopeConditions.join('/') : null,
                              rule.scopeRarities.length ? rule.scopeRarities.join('/') : null,
                              rule.scopeTrendThresholdPct != null ? `trend>${rule.scopeTrendThresholdPct}%` : null,
                            ].filter(Boolean).join(' · ') || 'All';
                            const adj = rule.adjustmentType === 'pct_adjust'
                              ? `${rule.adjustmentValue > 0 ? '+' : ''}${rule.adjustmentValue}%`
                              : fmt(Math.round(rule.adjustmentValue * 100));
                            return (
                              <tr key={rule.id} className="border-b border-zinc-800/50 last:border-0">
                                <td className="py-1.5 text-zinc-600 pr-2">{rule.priority}</td>
                                <td className="py-1.5 text-zinc-300 pr-2">{scope}</td>
                                <td className="py-1.5 text-zinc-400">{adj}</td>
                                <td className="py-1.5">
                                  <div className="flex items-center gap-1 justify-end">
                                    <button type="button" onClick={() => moveBuyRule(i, -1)} disabled={i === 0}
                                      className="px-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30">↑</button>
                                    <button type="button" onClick={() => moveBuyRule(i, 1)} disabled={i === buyRules.length - 1}
                                      className="px-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30">↓</button>
                                    <button type="button" onClick={() => setEditingBuyRule(rule)}
                                      className="px-1.5 text-zinc-500 hover:text-zinc-300">Edit</button>
                                    <button type="button" onClick={() => deleteBuyRule(rule.id)}
                                      className="px-1.5 text-zinc-600 hover:text-red-400">×</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buy Rule Modal */}
      {editingBuyRule !== false && (
        <BuyRuleModal
          rule={editingBuyRule}
          onClose={() => setEditingBuyRule(false)}
          onSave={saveBuyRule}
        />
      )}

      {/* Offer Builder */}
      <OfferBuilder
        items={offerItems}
        onUpdateItem={(idx, patch) => setOfferItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))}
        onRemoveItem={idx => setOfferItems(prev => prev.filter((_, i) => i !== idx))}
        onClear={() => setOfferItems([])}
        shopName={shopName}
      />

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Buy Rule Modal ───────────────────────────────────────────────────────

function BuyRuleModal({
  rule,
  onClose,
  onSave,
}: {
  rule: Partial<BuyRule> | null;
  onClose: () => void;
  onSave: (rule: Partial<BuyRule>) => Promise<void>;
}) {
  const [conditions, setConditions] = useState<string[]>(rule?.scopeConditions ?? []);
  const [rarities, setRarities] = useState<string[]>(rule?.scopeRarities ?? []);
  const [priceMin, setPriceMin] = useState(rule?.scopePriceMinCents != null ? (rule.scopePriceMinCents / 100).toFixed(2) : '');
  const [priceMax, setPriceMax] = useState(rule?.scopePriceMaxCents != null ? (rule.scopePriceMaxCents / 100).toFixed(2) : '');
  const [trendThreshold, setTrendThreshold] = useState(rule?.scopeTrendThresholdPct?.toString() ?? '');
  const [adjType, setAdjType] = useState<'pct_adjust' | 'flat'>(rule?.adjustmentType ?? 'pct_adjust');
  const [adjValue, setAdjValue] = useState(rule?.adjustmentValue?.toString() ?? '-10');
  const [saving, setSaving] = useState(false);

  function toggle(arr: string[], val: string, setter: (a: string[]) => void) {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        id: rule?.id,
        scopeConditions: conditions,
        scopeRarities: rarities,
        scopeSetCodes: [],
        scopePriceMinCents: priceMin ? Math.round(parseFloat(priceMin) * 100) : null,
        scopePriceMaxCents: priceMax ? Math.round(parseFloat(priceMax) * 100) : null,
        scopeTrendThresholdPct: trendThreshold ? parseFloat(trendThreshold) : null,
        adjustmentType: adjType,
        adjustmentValue: parseFloat(adjValue) || 0,
        isActive: true,
      });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-100">{rule?.id ? 'Edit Buy Rule' : 'Add Buy Rule'}</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Condition scope</label>
            <div className="flex gap-2 flex-wrap">
              {CONDITIONS.map(c => (
                <button key={c} type="button" onClick={() => toggle(conditions, c, setConditions)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${conditions.includes(c) ? 'bg-amber-400/20 border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {c}
                </button>
              ))}
              <span className="text-zinc-600 text-xs self-center">{conditions.length === 0 ? '(all)' : ''}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Rarity scope</label>
            <div className="flex gap-2 flex-wrap">
              {RARITIES.map(r => (
                <button key={r} type="button" onClick={() => toggle(rarities, r, setRarities)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${rarities.includes(r) ? 'bg-amber-400/20 border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {RARITY_LABELS[r]}
                </button>
              ))}
              <span className="text-zinc-600 text-xs self-center">{rarities.length === 0 ? '(all)' : ''}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Price ≥ $</label>
              <input type="number" min={0} step={0.01} value={priceMin} onChange={e => setPriceMin(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Price ≤ $</label>
              <input type="number" min={0} step={0.01} value={priceMax} onChange={e => setPriceMax(e.target.value)}
                placeholder="999.00"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">7-day trend threshold % (positive = up, negative = down)</label>
            <input type="number" step={1} value={trendThreshold} onChange={e => setTrendThreshold(e.target.value)}
              placeholder="e.g. -10 means dropping 10%+"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
          </div>

          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Adjustment</label>
            <div className="flex gap-2">
              <select value={adjType} onChange={e => setAdjType(e.target.value as typeof adjType)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500">
                <option value="pct_adjust">% adjust</option>
                <option value="flat">Flat price ($)</option>
              </select>
              <div className="flex items-center gap-1 flex-1">
                {adjType === 'flat' && <span className="text-zinc-500">$</span>}
                <input type="number" step={adjType === 'flat' ? 0.01 : 1} value={adjValue}
                  onChange={e => setAdjValue(e.target.value)}
                  placeholder={adjType === 'pct_adjust' ? '-10' : '0.50'}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
                {adjType === 'pct_adjust' && <span className="text-zinc-500">%</span>}
              </div>
            </div>
            {adjType === 'pct_adjust' && <p className="text-[10px] text-zinc-600 mt-1">Negative = reduce buy price. E.g. -10 = pay 10% less than matrix.</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Condition Matrix Tab ─────────────────────────────────────────────────

const CONDITION_INFO: Record<string, { name: string; desc: string }> = {
  NM:  { name: 'Near Mint',         desc: 'No visible wear. Fresh out of pack.' },
  LP:  { name: 'Lightly Played',    desc: 'Minor edge or surface wear. Still looks great.' },
  MP:  { name: 'Moderately Played', desc: 'Noticeable creases, scuffs, or whitening.' },
  HP:  { name: 'Heavily Played',    desc: 'Heavy wear but still tournament-legal in sleeves.' },
  DMG: { name: 'Damaged',           desc: 'Tears, water damage, or writing. Disclose clearly.' },
};

function MatrixTab() {
  const [matrix, setMatrix] = useState<Record<string, number>>({ NM: 100, LP: 85, MP: 70, HP: 50, DMG: 25 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetch('/api/shops/pricing/matrix')
      .then(r => r.json())
      .then((d: { matrix: Record<string, number> }) => { if (d.matrix) setMatrix(d.matrix); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/shops/pricing/matrix', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrix }),
      });
      if (res.ok) setToast({ message: 'Condition matrix saved', type: 'success' });
      else setToast({ message: 'Failed to save', type: 'error' });
    } finally { setSaving(false); }
  }

  const nmExample = 1000;

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Condition Pricing Matrix</h2>
        <p className="text-sm text-zinc-500 mt-1">Set default pricing multipliers relative to NM (Near Mint) market price. These apply when cards are added via scan or bulk upload.</p>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Condition</th>
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Description</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">% of NM</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">Example ($10 NM)</th>
            </tr>
          </thead>
          <tbody>
            {CONDITIONS.map(cond => {
              const info = CONDITION_INFO[cond];
              return (
                <tr key={cond} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    <span className="text-zinc-200 text-sm font-medium">{info.name}</span>
                    <span className="text-zinc-500 text-sm ml-1">({cond})</span>
                  </td>
                  <td className="px-4 py-3 align-middle text-zinc-500 text-sm">{info.desc}</td>
                  <td className="px-4 py-3 align-middle text-right">
                    {cond === 'NM' ? (
                      <span className="text-zinc-500 text-sm">100%</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number" min={0} max={100} step={1}
                          value={matrix[cond] ?? ''}
                          onChange={e => setMatrix(prev => ({ ...prev, [cond]: Number(e.target.value) }))}
                          className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-right text-zinc-200 focus:outline-none focus:border-amber-500 text-sm"
                        />
                        <span className="text-zinc-500 text-sm">%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle text-right text-zinc-400 tabular-nums text-sm">
                    {fmt(Math.round(nmExample * (matrix[cond] ?? 100) / 100))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={save} disabled={saving}
        className="px-6 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60">
        {saving ? 'Saving…' : 'Save Matrix'}
      </button>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Floor Prices Tab ─────────────────────────────────────────────────────

function FloorsTab() {
  const [floors, setFloors] = useState<Record<string, number>>({ global: 10, C: 10, U: 25, R: 50, M: 100 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetch('/api/shops/pricing/floors')
      .then(r => r.json())
      .then((d: { floors: Record<string, number> }) => { if (d.floors) setFloors(d.floors); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/shops/pricing/floors', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floors }),
      });
      if (res.ok) setToast({ message: 'Floor prices saved', type: 'success' });
      else setToast({ message: 'Failed to save', type: 'error' });
    } finally { setSaving(false); }
  }

  function setDollars(key: string, val: string) {
    setFloors(prev => ({ ...prev, [key]: Math.round(parseFloat(val || '0') * 100) }));
  }

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Global Floor Prices</h2>
        <p className="text-sm text-zinc-500 mt-1">Minimum prices enforced during bulk reprice operations. Manual edits will show a warning if you go below these values.</p>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-400 font-medium">Category</th>
              <th className="text-right px-4 py-3 text-zinc-400 font-medium">Floor Price</th>
            </tr>
          </thead>
          <tbody>
            {RARITIES.map(r => (
              <tr key={r} className="border-b border-zinc-800/50">
                <td className="px-4 py-3 text-zinc-200">{RARITY_LABELS[r]} ({r})</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-zinc-500">$</span>
                    <input type="number" min={0} step={0.01}
                      value={((floors[r] ?? 0) / 100).toFixed(2)}
                      onChange={e => setDollars(r, e.target.value)}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-right text-zinc-200 focus:outline-none focus:border-amber-500 text-sm"
                    />
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-t border-zinc-700 bg-zinc-900/40">
              <td className="px-4 py-3 text-zinc-200 font-medium">Global floor (all cards)</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-zinc-500">$</span>
                  <input type="number" min={0} step={0.01}
                    value={((floors.global ?? 0) / 100).toFixed(2)}
                    onChange={e => setDollars('global', e.target.value)}
                    className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-right text-zinc-200 focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button type="button" onClick={save} disabled={saving}
        className="px-6 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60">
        {saving ? 'Saving…' : 'Save Floor Prices'}
      </button>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Rules Engine Tab ─────────────────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  market_pct: 'TCG market ±%',
  flat: 'Flat price',
  condition_matrix_pct: 'Condition Matrix',
};

function ruleDescription(rule: PricingRule): string {
  const scope: string[] = [];
  if (rule.scopeConditions.length) scope.push(rule.scopeConditions.join('/'));
  if (rule.scopeRarities.length) scope.push(rule.scopeRarities.join('/'));
  if (rule.scopeSetCodes.length) scope.push(rule.scopeSetCodes.join('/'));
  const scopeStr = scope.join(' · ') || 'All cards';

  let stratStr = STRATEGY_LABELS[rule.strategy] ?? rule.strategy;
  if (rule.strategy === 'market_pct' && rule.strategyValue != null) {
    stratStr = `TCG market ${rule.strategyDirection === 'below' ? '-' : '+'}${rule.strategyValue}%`;
  } else if (rule.strategy === 'flat' && rule.strategyValue != null) {
    stratStr = `Flat ${fmt(Math.round(rule.strategyValue * 100))}`;
  }

  return `${scopeStr} → ${stratStr}`;
}

interface RuleModalProps {
  rule: Partial<PricingRule> | null;
  onClose: () => void;
  onSave: (rule: Partial<PricingRule>) => Promise<void>;
}

function RuleModal({ rule, onClose, onSave }: RuleModalProps) {
  const [conditions, setConditions] = useState<string[]>(rule?.scopeConditions ?? []);
  const [rarities, setRarities] = useState<string[]>(rule?.scopeRarities ?? []);
  const [strategy, setStrategy] = useState<string>(rule?.strategy ?? 'market_pct');
  const [direction, setDirection] = useState<string>(rule?.strategyDirection ?? 'above');
  const [value, setValue] = useState<string>(rule?.strategyValue?.toString() ?? '10');
  const [floorDollars, setFloorDollars] = useState<string>(rule?.floorPriceCents ? (rule.floorPriceCents / 100).toFixed(2) : '');
  const [preview, setPreview] = useState<{ affectedCount: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const body = {
      id: rule?.id ?? '', priority: rule?.priority ?? 1,
      scopeConditions: conditions, scopeRarities: rarities, scopeSetCodes: [],
      scopePriceMinCents: null, scopePriceMaxCents: null,
      strategy: strategy as PricingRule['strategy'],
      strategyValue: parseFloat(value) || null,
      strategyDirection: direction as 'above' | 'below',
      floorPriceCents: floorDollars ? Math.round(parseFloat(floorDollars) * 100) : null,
      isActive: true,
    };
    const t = setTimeout(() => {
      fetch('/api/shops/pricing/rules/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: body }),
      }).then(r => r.json()).then((d: { affectedCount: number }) => setPreview(d)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [conditions, rarities, strategy, direction, value, floorDollars, rule]);

  function toggleArr(arr: string[], val: string, setter: (a: string[]) => void) {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        id: rule?.id,
        scopeConditions: conditions,
        scopeRarities: rarities,
        scopeSetCodes: [],
        scopePriceMinCents: null,
        scopePriceMaxCents: null,
        strategy: strategy as PricingRule['strategy'],
        strategyValue: parseFloat(value) || null,
        strategyDirection: direction as 'above' | 'below',
        floorPriceCents: floorDollars ? Math.round(parseFloat(floorDollars) * 100) : null,
        isActive: true,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-100">{rule?.id ? 'Edit Rule' : 'Add Rule'}</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wide block mb-1.5">Condition scope</label>
            <div className="flex gap-2 flex-wrap">
              {CONDITIONS.map(c => (
                <button key={c} type="button"
                  onClick={() => toggleArr(conditions, c, setConditions)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${conditions.includes(c) ? 'bg-amber-400/20 border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {c}
                </button>
              ))}
              <span className="text-zinc-600 text-xs self-center">{conditions.length === 0 ? '(all conditions)' : ''}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wide block mb-1.5">Rarity scope</label>
            <div className="flex gap-2 flex-wrap">
              {RARITIES.map(r => (
                <button key={r} type="button"
                  onClick={() => toggleArr(rarities, r, setRarities)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${rarities.includes(r) ? 'bg-amber-400/20 border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {RARITY_LABELS[r]}
                </button>
              ))}
              <span className="text-zinc-600 text-xs self-center">{rarities.length === 0 ? '(all rarities)' : ''}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wide block mb-1.5">Strategy</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500">
              <option value="market_pct">TCG Market ±%</option>
              <option value="flat">Flat price ($)</option>
              <option value="condition_matrix_pct">Condition Matrix</option>
            </select>
          </div>

          {strategy === 'market_pct' && (
            <div className="flex gap-2">
              <select value={direction} onChange={e => setDirection(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500">
                <option value="above">Above market</option>
                <option value="below">Below market</option>
              </select>
              <div className="flex items-center gap-1 flex-1">
                <input type="number" min={0} max={200} step={0.1} value={value} onChange={e => setValue(e.target.value)}
                  placeholder="10"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
                <span className="text-zinc-500">%</span>
              </div>
            </div>
          )}

          {strategy === 'flat' && (
            <div className="flex items-center gap-1">
              <span className="text-zinc-500">$</span>
              <input type="number" min={0} step={0.01} value={value} onChange={e => setValue(e.target.value)}
                placeholder="0.50"
                className="w-32 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wide block mb-1.5">Floor override (optional)</label>
            <div className="flex items-center gap-1">
              <span className="text-zinc-500">$</span>
              <input type="number" min={0} step={0.01} value={floorDollars} onChange={e => setFloorDollars(e.target.value)}
                placeholder="0.25"
                className="w-32 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          {preview != null && (
            <p className="text-xs text-zinc-500 bg-zinc-800 rounded-lg px-3 py-2">
              This rule would affect <span className="text-amber-400 font-medium">{preview.affectedCount}</span> cards in your current inventory.
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RulesTab() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<Partial<PricingRule> | null | false>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadRules = useCallback(async () => {
    const res = await fetch('/api/shops/pricing/rules');
    const d = await res.json() as { rules: PricingRule[] };
    setRules(d.rules ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  async function saveRule(rule: Partial<PricingRule>) {
    if (rule.id) {
      await fetch(`/api/shops/pricing/rules/${rule.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
    } else {
      await fetch('/api/shops/pricing/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
    }
    await loadRules();
    setToast({ message: rule.id ? 'Rule updated' : 'Rule created', type: 'success' });
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return;
    await fetch(`/api/shops/pricing/rules/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
    setToast({ message: 'Rule deleted', type: 'success' });
  }

  async function moveRule(index: number, dir: -1 | 1) {
    const newRules = [...rules];
    const target = index + dir;
    if (target < 0 || target >= newRules.length) return;
    [newRules[index], newRules[target]] = [newRules[target], newRules[index]];
    setRules(newRules);
    await fetch('/api/shops/pricing/rules/reorder', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newRules.map(r => r.id) }),
    });
  }

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Sale Pricing Rules</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Rules apply in priority order — first match wins.</p>
        </div>
        <button type="button" onClick={() => setEditingRule({})}
          className="px-4 py-2 rounded-xl bg-amber-400/20 border border-amber-500/40 text-amber-300 text-sm font-medium hover:bg-amber-400/30 transition-colors">
          + Add Rule
        </button>
      </div>

      {rules.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-10 text-center text-zinc-500 text-sm">
          No rules yet. Add your first rule to automate pricing.
        </div>
      )}

      {rules.length > 0 && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium w-12">Priority</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Scope → Strategy</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Floor</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, i) => (
                <tr key={rule.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-500 tabular-nums">{rule.priority}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{ruleDescription(rule)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500 text-xs tabular-nums">
                    {rule.floorPriceCents != null ? fmt(rule.floorPriceCents) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button type="button" onClick={() => moveRule(i, -1)} disabled={i === 0}
                        className="px-1.5 py-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors text-xs">↑</button>
                      <button type="button" onClick={() => moveRule(i, 1)} disabled={i === rules.length - 1}
                        className="px-1.5 py-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors text-xs">↓</button>
                      <button type="button" onClick={() => setEditingRule(rule)}
                        className="px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Edit</button>
                      <button type="button" onClick={() => deleteRule(rule.id)}
                        className="px-2 py-0.5 text-xs text-zinc-600 hover:text-red-400 transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Example rule set */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3 text-sm">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Example Rule Set</h3>
        <p className="text-zinc-500 text-xs">A common starter setup that prices by condition and protects against bottoming out. Rules are checked top-to-bottom — the first match wins.</p>
        <div className="rounded-lg border border-zinc-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-800 border-b border-zinc-700">
                <th className="text-left px-3 py-2 text-zinc-400 font-medium w-8">#</th>
                <th className="text-left px-3 py-2 text-zinc-400 font-medium">Scope</th>
                <th className="text-left px-3 py-2 text-zinc-400 font-medium">Strategy</th>
                <th className="text-right px-3 py-2 text-zinc-400 font-medium">Floor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {[
                { n: 1, scope: 'NM · Mythic (M)',    strat: 'TCG market + 10%', floor: '$1.00' },
                { n: 2, scope: 'NM · Rare (R)',       strat: 'TCG market + 5%',  floor: '$0.50' },
                { n: 3, scope: 'LP · All cards',      strat: 'TCG market − 10%', floor: '$0.25' },
                { n: 4, scope: 'MP · All cards',      strat: 'Condition Matrix',  floor: '$0.25' },
                { n: 5, scope: 'HP, DMG · All cards', strat: 'Condition Matrix',  floor: '$0.10' },
                { n: 6, scope: 'NM · Common (C)',     strat: 'Flat $0.25',        floor: '—' },
              ].map(row => (
                <tr key={row.n} className="hover:bg-zinc-800/40">
                  <td className="px-3 py-2 text-zinc-600">{row.n}</td>
                  <td className="px-3 py-2 text-zinc-300">{row.scope}</td>
                  <td className="px-3 py-2 text-zinc-400">{row.strat}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.floor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingRule !== false && (
        <RuleModal
          rule={editingRule}
          onClose={() => setEditingRule(false)}
          onSave={saveRule}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Reprice Wizard Tab ───────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3;

interface ScopeConfig {
  type: 'all' | 'filter' | 'stale';
  conditions?: string[];
  rarities?: string[];
  setCodes?: string[];
  staleDays?: number;
}

interface StrategyConfig {
  type: 'rules' | 'market_exact' | 'market_pct' | 'flat' | 'condition_matrix';
  direction?: 'above' | 'below';
  value?: number;
}

function WizardTab() {
  const [step, setStep] = useState<WizardStep>(1);
  const [scope, setScope] = useState<ScopeConfig>({ type: 'all' });
  const [strategy, setStrategy] = useState<StrategyConfig>({ type: 'market_exact' });
  const [respectFloors, setRespectFloors] = useState(true);
  const [preview, setPreview] = useState<{ items: WizardPreviewItem[]; totalCurrentCents: number; totalNewCents: number; floorHitCount: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function loadPreview() {
    setLoading(true);
    try {
      const res = await fetch('/api/shops/pricing/wizard/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, strategy, respectFloors }),
      });
      const d = await res.json() as typeof preview;
      setPreview(d);
      setStep(3);
    } finally { setLoading(false); }
  }

  async function applyReprice() {
    if (!preview) return;
    setApplying(true);
    try {
      const updates = preview.items.map(i => ({ id: i.id, priceCents: i.newCents }));
      const res = await fetch('/api/shops/inventory/bulk-reprice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const d = await res.json() as { updated: number; total: number };
      setToast({ message: `${d.updated} cards repriced successfully`, type: 'success' });
      setStep(1);
      setPreview(null);
      setShowAll(false);
    } finally { setApplying(false); }
  }

  const displayItems = showAll ? (preview?.items ?? []) : (preview?.items ?? []).slice(0, 5);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        {([1, 2, 3] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? 'bg-amber-400 text-black' : step > s ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 text-zinc-600'}`}>
              {step > s ? '✓' : s}
            </div>
            <span className={`text-xs ${step === s ? 'text-zinc-200' : 'text-zinc-600'}`}>
              {s === 1 ? 'Scope' : s === 2 ? 'Strategy' : 'Preview'}
            </span>
            {i < 2 && <div className="w-8 h-px bg-zinc-700 mx-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">Step 1 — Select Scope</h2>
          <div className="space-y-3">
            {([
              { key: 'all', label: 'All inventory' },
              { key: 'filter', label: 'Filter by condition / rarity' },
              { key: 'stale', label: 'Stale prices only (not updated in 30+ days with >10% market move)' },
            ] as { key: ScopeConfig['type']; label: string }[]).map(opt => (
              <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="scope" checked={scope.type === opt.key}
                  onChange={() => setScope({ type: opt.key })}
                  className="accent-amber-400 mt-0.5" />
                <span className="text-sm text-zinc-300">{opt.label}</span>
              </label>
            ))}
          </div>

          {scope.type === 'filter' && (
            <div className="space-y-3 pl-6">
              <div>
                <p className="text-xs text-zinc-500 mb-2">Conditions</p>
                <div className="flex gap-2 flex-wrap">
                  {CONDITIONS.map(c => (
                    <button key={c} type="button"
                      onClick={() => setScope(prev => ({
                        ...prev,
                        conditions: prev.conditions?.includes(c)
                          ? prev.conditions.filter(x => x !== c)
                          : [...(prev.conditions ?? []), c]
                      }))}
                      className={`px-3 py-1 rounded-lg text-xs border transition-colors ${scope.conditions?.includes(c) ? 'bg-amber-400/20 border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-400'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-2">Rarities</p>
                <div className="flex gap-2 flex-wrap">
                  {RARITIES.map(r => (
                    <button key={r} type="button"
                      onClick={() => setScope(prev => ({
                        ...prev,
                        rarities: prev.rarities?.includes(r)
                          ? prev.rarities.filter(x => x !== r)
                          : [...(prev.rarities ?? []), r]
                      }))}
                      className={`px-3 py-1 rounded-lg text-xs border transition-colors ${scope.rarities?.includes(r) ? 'bg-amber-400/20 border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-400'}`}>
                      {RARITY_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button type="button" onClick={() => setStep(2)}
            className="px-6 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors">
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">Step 2 — Choose Strategy</h2>
          <div className="space-y-3">
            {([
              { key: 'rules', label: 'Apply my Pricing Rules (uses Rules Engine, respects floors)' },
              { key: 'market_exact', label: 'TCGPlayer market price (exact)' },
              { key: 'market_pct', label: 'TCGPlayer market ± %' },
              { key: 'flat', label: 'Flat price (set all to same price)' },
              { key: 'condition_matrix', label: 'Condition Matrix (apply matrix multipliers to NM market)' },
            ] as { key: StrategyConfig['type']; label: string }[]).map(opt => (
              <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="strategy" checked={strategy.type === opt.key}
                  onChange={() => setStrategy({ type: opt.key })}
                  className="accent-amber-400 mt-0.5" />
                <span className="text-sm text-zinc-300">{opt.label}</span>
              </label>
            ))}
          </div>

          {strategy.type === 'market_pct' && (
            <div className="flex gap-2 pl-6">
              <select value={strategy.direction ?? 'above'} onChange={e => setStrategy(prev => ({ ...prev, direction: e.target.value as 'above' | 'below' }))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500">
                <option value="above">Above market</option>
                <option value="below">Below market</option>
              </select>
              <div className="flex items-center gap-1">
                <input type="number" min={0} step={0.1} value={strategy.value ?? ''}
                  onChange={e => setStrategy(prev => ({ ...prev, value: parseFloat(e.target.value) }))}
                  placeholder="10"
                  className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
                <span className="text-zinc-500">%</span>
              </div>
            </div>
          )}

          {strategy.type === 'flat' && (
            <div className="flex items-center gap-1 pl-6">
              <span className="text-zinc-500">$</span>
              <input type="number" min={0} step={0.01} value={strategy.value ?? ''}
                onChange={e => setStrategy(prev => ({ ...prev, value: parseFloat(e.target.value) }))}
                placeholder="0.50"
                className="w-32 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={respectFloors} onChange={e => setRespectFloors(e.target.checked)} className="accent-amber-400" />
            <span className="text-sm text-zinc-300">Respect floor prices</span>
          </label>

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 transition-colors">
              ← Back
            </button>
            <button type="button" onClick={loadPreview} disabled={loading}
              className="px-6 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60">
              {loading ? 'Calculating…' : 'Preview →'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Step 3 — Preview & Confirm</h2>
            <span className="text-sm text-zinc-500">{preview.items.length} cards will change</span>
          </div>

          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Card</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium w-12">Cond</th>
                  <th className="text-right px-4 py-3 text-zinc-400 font-medium">Current</th>
                  <th className="text-right px-4 py-3 text-zinc-400 font-medium">New</th>
                  <th className="text-right px-4 py-3 text-zinc-400 font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map(item => {
                  const delta = item.newCents - item.currentCents;
                  return (
                    <tr key={item.id} className={`border-b border-zinc-800/50 last:border-0 ${item.hitFloor ? 'bg-yellow-900/10' : ''}`}>
                      <td className="px-4 py-2.5 text-zinc-200 max-w-48">
                        <span className="block truncate"><CardNameLink name={item.cardName} /></span>
                        {item.hitFloor && <span className="text-[10px] text-yellow-500">hit floor</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">{item.condition}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{fmt(item.currentCents)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-200">{fmt(item.newCents)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-zinc-600'}`}>
                        {delta === 0 ? '—' : fmtDelta(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!showAll && preview.items.length > 5 && (
              <div className="border-t border-zinc-800 px-4 py-2.5 bg-zinc-900/50">
                <button type="button" onClick={() => setShowAll(true)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  Show all {preview.items.length} cards →
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {preview.floorHitCount > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2 text-yellow-300 text-xs">
                ⚠ {preview.floorHitCount} cards were adjusted up to floor price
              </div>
            )}
            <div className="bg-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-xs tabular-nums">
              Total: {fmt(preview.totalCurrentCents)} → {fmt(preview.totalNewCents)}{' '}
              <span className={preview.totalNewCents >= preview.totalCurrentCents ? 'text-green-400' : 'text-red-400'}>
                ({fmtDelta(preview.totalNewCents - preview.totalCurrentCents)})
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 transition-colors">
              ← Back
            </button>
            <button type="button" onClick={applyReprice} disabled={applying}
              className="px-6 py-2 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60">
              {applying ? 'Applying…' : 'Confirm & Apply'}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Purchase History Tab ─────────────────────────────────────────────────

interface Purchase {
  id: string;
  sellerName: string | null;
  sellerContact: string | null;
  totalPaidCents: number;
  notes: string | null;
  status: string;
  createdAt: string;
  itemCount: number;
}

interface PurchaseItem {
  id: string;
  cardName: string;
  setCode: string;
  condition: string;
  foil: boolean;
  quantity: number;
  buyPriceCents: number;
  tcgMarketCents: number;
  targetSellPriceCents: number | null;
}

function PurchaseHistoryTab() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, PurchaseItem[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/shops/purchases')
      .then(r => r.json())
      .then((d: { purchases: Purchase[] }) => setPurchases(d.purchases ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (detail[id]) return;
    setLoadingDetail(id);
    try {
      const res = await fetch(`/api/shops/purchases/${id}`);
      const d = await res.json() as { items: PurchaseItem[] };
      setDetail(prev => ({ ...prev, [id]: d.items ?? [] }));
    } finally { setLoadingDetail(null); }
  }

  if (loading) return <div className="text-zinc-500 text-sm py-12 text-center">Loading…</div>;

  if (purchases.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-3">
        <div className="text-zinc-600 text-sm">No purchases recorded yet.</div>
        <p className="text-xs text-zinc-600">Confirm a buylist offer in Card Lookup to record a purchase.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900 border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-zinc-400 font-medium">Date</th>
            <th className="text-left px-4 py-3 text-zinc-400 font-medium">Seller</th>
            <th className="text-right px-4 py-3 text-zinc-400 font-medium">Cards</th>
            <th className="text-right px-4 py-3 text-zinc-400 font-medium">Total Paid</th>
            <th className="text-right px-4 py-3 text-zinc-400 font-medium">Status</th>
            <th className="px-4 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {purchases.map(p => (
            <>
              <tr
                key={p.id}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                onClick={() => toggleExpand(p.id)}
              >
                <td className="px-4 py-3 text-zinc-400 tabular-nums text-xs">
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-zinc-200">
                  {p.sellerName ?? <span className="text-zinc-600 italic">Anonymous</span>}
                  {p.sellerContact && <div className="text-xs text-zinc-600">{p.sellerContact}</div>}
                </td>
                <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">{p.itemCount}</td>
                <td className="px-4 py-3 text-right text-zinc-200 font-medium tabular-nums">{fmt(p.totalPaidCents)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-900/30 text-green-400 border border-green-800/40">
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-zinc-600 text-xs">
                  {expandedId === p.id ? '▲' : '▼'}
                </td>
              </tr>
              {expandedId === p.id && (
                <tr key={`${p.id}-detail`} className="border-b border-zinc-800/50 bg-zinc-900/30">
                  <td colSpan={6} className="px-4 py-4">
                    {loadingDetail === p.id && <div className="text-zinc-600 text-xs py-2">Loading…</div>}
                    {detail[p.id] && (
                      <div className="space-y-3">
                        {p.notes && <p className="text-xs text-zinc-500 italic">{p.notes}</p>}
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-zinc-700">
                              <th className="text-left pb-2 text-zinc-500 font-medium pr-4">Card</th>
                              <th className="text-left pb-2 text-zinc-500 font-medium pr-4">Cond</th>
                              <th className="text-center pb-2 text-zinc-500 font-medium pr-4">Qty</th>
                              <th className="text-right pb-2 text-zinc-500 font-medium pr-4">TCG Market</th>
                              <th className="text-right pb-2 text-zinc-500 font-medium pr-4">Paid</th>
                              <th className="text-right pb-2 text-zinc-500 font-medium">Target Sell</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail[p.id].map(item => (
                              <tr key={item.id} className="border-b border-zinc-800/30 last:border-0">
                                <td className="py-1.5 pr-4 text-zinc-200">
                                  <CardNameLink name={item.cardName} />{item.foil ? ' ✦' : ''}
                                  <span className="ml-1 text-zinc-600">{item.setCode.toUpperCase()}</span>
                                </td>
                                <td className="py-1.5 pr-4 text-zinc-400">{item.condition}</td>
                                <td className="py-1.5 pr-4 text-center text-zinc-400">{item.quantity}</td>
                                <td className="py-1.5 pr-4 text-right text-zinc-500 tabular-nums">{fmt(item.tcgMarketCents)}</td>
                                <td className="py-1.5 pr-4 text-right text-zinc-300 font-medium tabular-nums">{fmt(item.buyPriceCents)}</td>
                                <td className="py-1.5 text-right text-zinc-500 tabular-nums">
                                  {item.targetSellPriceCents != null ? fmt(item.targetSellPriceCents) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page Shell ───────────────────────────────────────────────────────────

function PricingContent() {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab') as TopTab | null;
  const activeTop: TopTab = rawTab === 'purchase' ? 'purchase' : 'sale';
  // Treat no-tab as sale for backwards compat, but canonical URL is ?tab=sale

  const rawSub = searchParams.get('sub');
  const activeSaleSub: SaleSub = (rawSub && SALE_SUBS.some(t => t.key === rawSub) ? rawSub : 'rules') as SaleSub;
  const activePurchaseSub: PurchaseSub = rawSub === 'history' ? 'history' : 'lookup';

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sale Pricing */}
        {activeTop === 'sale' && (
          <>
            <div>
              <h1 className="text-xl font-bold">Sale Pricing</h1>
              <p className="text-zinc-500 text-sm mt-0.5">Rules, matrices, floors, and bulk repricing for your inventory</p>
            </div>
            <div className="flex gap-1 bg-zinc-900/50 rounded-xl p-1 border border-zinc-800 w-fit flex-wrap">
              {SALE_SUBS.map(t => (
                <Link key={t.key} href={`/shop/pricing?tab=sale&sub=${t.key}`}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeSaleSub === t.key ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {t.label}
                </Link>
              ))}
            </div>
            {activeSaleSub === 'rules'  && <RulesTab />}
            {activeSaleSub === 'matrix' && <MatrixTab />}
            {activeSaleSub === 'floors' && <FloorsTab />}
            {activeSaleSub === 'wizard' && <WizardTab />}
          </>
        )}

        {/* Purchase Pricing */}
        {activeTop === 'purchase' && (
          <>
            <div>
              <h1 className="text-xl font-bold">Purchase Pricing</h1>
              <p className="text-zinc-500 text-sm mt-0.5">Look up buy prices and guide employees during card purchases</p>
            </div>
            <div className="flex gap-1 bg-zinc-900/50 rounded-xl p-1 border border-zinc-800 w-fit">
              <Link href="/shop/pricing?tab=purchase&sub=lookup"
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePurchaseSub === 'lookup' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Card Lookup
              </Link>
              <Link href="/shop/pricing?tab=purchase&sub=history"
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePurchaseSub === 'history' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Purchase History
              </Link>
            </div>
            {activePurchaseSub === 'lookup'  && <BuyTab />}
            {activePurchaseSub === 'history' && <PurchaseHistoryTab />}
          </>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  return <Suspense><PricingContent /></Suspense>;
}
