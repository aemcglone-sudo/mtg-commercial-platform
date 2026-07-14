'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CardNameLink } from '@/components/CardNameLink';
import QuickAddCard from './QuickAddCard';
import CardDetailModal, { type DeckSummary } from './CardDetailModal';
import { getRulesHint } from '@/lib/rules-hints';


export interface CollectionCardData {
  name: string;
  quantity: number;
  priceUsd: number | null;
  imageUrl: string | null;
  scryfallUri: string | null;
  setName: string | null;
  typeLine: string | null;
  colors: string[];          // ['W','U','B','R','G']
  cmc: number | null;
  rarity: string | null;
  oracleText?: string | null;
  artist?: string | null;
  collectionType?: 'paper' | 'arena';
}

interface Props {
  cards: CollectionCardData[];
  totalCards: number;
  detectedFormat?: string;
  decks?: DeckSummary[];
  onCollectionChange?: (updated: { collectionCards: CollectionCardData[]; collectionSize: number; totalCards: number; detectedFormat: string }) => void;
  onAskAboutCard?: (cardName: string, question: string) => void;
}


type ViewMode = 'grid' | 'table';
type SortKey = 'name' | 'quantity' | 'price' | 'cmc' | 'rarity' | 'type' | 'colors';
type PriceTier = 'all' | 'under1' | '1to10' | '10to50' | 'over50';
type QtyFilter = 'all' | 'singles' | 'multiples';

// MTG colors in canonical order
const COLORS = [
  { id: 'W', label: 'White', bg: 'bg-yellow-50',   text: 'text-yellow-900', border: 'border-yellow-300', active: 'bg-yellow-100 border-yellow-400' },
  { id: 'U', label: 'Blue',  bg: 'bg-blue-600',    text: 'text-white',      border: 'border-blue-700',   active: 'bg-blue-700 border-blue-500' },
  { id: 'B', label: 'Black', bg: 'bg-zinc-700',    text: 'text-zinc-100',   border: 'border-zinc-600',   active: 'bg-zinc-600 border-zinc-400' },
  { id: 'R', label: 'Red',   bg: 'bg-red-600',     text: 'text-white',      border: 'border-red-700',    active: 'bg-red-700 border-red-500' },
  { id: 'G', label: 'Green', bg: 'bg-green-700',   text: 'text-white',      border: 'border-green-800',  active: 'bg-green-800 border-green-600' },
  { id: 'C', label: 'Colorless', bg: 'bg-gradient-to-br from-slate-300 via-zinc-200 to-slate-400', text: 'text-zinc-800', border: 'border-slate-400',  active: 'border-slate-300' },
  { id: 'M', label: 'Multi',     bg: 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500', text: 'text-amber-900', border: 'border-amber-500', active: 'border-amber-300' },
] as const;
type ColorId = typeof COLORS[number]['id'];

const CARD_TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle'] as const;
type CardType = typeof CARD_TYPES[number];

const RARITIES = [
  { id: 'common',   label: 'C', title: 'Common',   color: 'text-zinc-400 border-zinc-600' },
  { id: 'uncommon', label: 'U', title: 'Uncommon',  color: 'text-slate-400 border-slate-500' },
  { id: 'rare',     label: 'R', title: 'Rare',      color: 'text-amber-400 border-amber-600' },
  { id: 'mythic',   label: 'M', title: 'Mythic',    color: 'text-orange-400 border-orange-600' },
] as const;
type Rarity = typeof RARITIES[number]['id'];

const PRICE_TIERS: { id: PriceTier; label: string }[] = [
  { id: 'all', label: 'Any' }, { id: 'under1', label: '< $1' },
  { id: '1to10', label: '$1–10' }, { id: '10to50', label: '$10–50' }, { id: 'over50', label: '$50+' },
];
const CMC_OPTIONS = [0, 1, 2, 3, 4, 5, '6+'] as const;
type CmcOption = typeof CMC_OPTIONS[number];

function getCardType(typeLine: string | null | undefined): string | null {
  if (!typeLine) return null;
  for (const t of CARD_TYPES) if (typeLine.includes(t)) return t;
  return null;
}

function getColorGroup(colors: string[] | null | undefined): ColorId {
  if (!colors || colors.length === 0) return 'C';
  if (colors.length > 1) return 'M';
  return (colors[0] ?? 'C') as ColorId;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-zinc-500 w-10 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative group/tip inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-zinc-700 px-2 py-1 text-[11px] text-zinc-100 opacity-0 group-hover/tip:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </span>
  );
}

function Pill({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  const btn = (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
        active ? 'bg-amber-400 text-black font-medium' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
      }`}
    >{children}</button>
  );
  return title ? <Tip label={title}>{btn}</Tip> : btn;
}

function matchesPriceTier(price: number | null, tier: PriceTier) {
  if (tier === 'all') return true;
  const p = price ?? 0;
  if (tier === 'under1')  return p < 1;
  if (tier === '1to10')   return p >= 1 && p < 10;
  if (tier === '10to50')  return p >= 10 && p < 50;
  if (tier === 'over50')  return p >= 50;
  return true;
}

function matchesCmc(cmc: number | null, selected: CmcOption[]): boolean {
  if (selected.length === 0) return true;
  const c = cmc ?? 0;
  return selected.some((s) => {
    if (s === '6+') return c >= 6;
    return c === s;
  });
}

export default function CollectionBrowser({ cards, totalCards, detectedFormat, decks, onCollectionChange, onAskAboutCard }: Props) {
  const [view, setView] = useState<ViewMode>('grid');
  const [cardZoom, setCardZoom] = useState<'sm' | 'md' | 'lg'>('md');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedColors, setSelectedColors] = useState<ColorId[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<CardType[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<Rarity[]>([]);
  const [selectedCmc, setSelectedCmc] = useState<CmcOption[]>([]);
  const [priceTier, setPriceTier] = useState<PriceTier>('all');
  const [qtyFilter, setQtyFilter] = useState<QtyFilter>('all');
  const [selectedSet, setSelectedSet] = useState<string>('');
  const [legendaryOnly, setLegendaryOnly] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<CollectionCardData | null>(null);
  const [hoveredRulesHint, setHoveredRulesHint] = useState<string | null>(null);
  const [removingName, setRemovingName] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<CollectionCardData | null>(null);
  const [localCards, setLocalCards] = useState<CollectionCardData[]>(cards);

  // Keep local cards in sync with prop
  useEffect(() => {
    setLocalCards(cards);
  }, [cards]);

  const toggleItem = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleRemove = useCallback(async (name: string) => {
    setRemovingName(name);
    try {
      const res = await fetch('/api/collection/card', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) onCollectionChange?.(await res.json());
    } finally { setRemovingName(null); }
  }, [onCollectionChange]);

  const handleAdd = useCallback(async (name: string, quantity: number) => {
    const res = await fetch('/api/collection/card', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, quantity, collectionType: 'paper' }),
    });
    if (res.ok) {
      onCollectionChange?.(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || `Failed to add "${name}"`);
    }
  }, [onCollectionChange]);


  const setOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) if (c.setName) counts.set(c.setName, (counts.get(c.setName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = localCards.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (!matchesPriceTier(c.priceUsd, priceTier)) return false;
      if (qtyFilter === 'singles'   && c.quantity !== 1) return false;
      if (qtyFilter === 'multiples' && c.quantity <= 1)  return false;
      if (selectedSet && c.setName !== selectedSet) return false;
      if (selectedColors.length) {
        const grp = getColorGroup(c.colors);
        if (!selectedColors.includes(grp)) return false;
      }
      if (legendaryOnly && !c.typeLine?.includes('Legendary')) return false;
      if (selectedTypes.length) {
        const t = getCardType(c.typeLine);
        if (!t || !selectedTypes.includes(t as CardType)) return false;
      }
      if (selectedRarities.length && c.rarity && !selectedRarities.includes(c.rarity as Rarity)) return false;
      if (!matchesCmc(c.cmc, selectedCmc)) return false;
      return true;
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name')     cmp = a.name.localeCompare(b.name);
      if (sortKey === 'quantity') cmp = a.quantity - b.quantity;
      if (sortKey === 'price')    cmp = (a.priceUsd ?? 0) - (b.priceUsd ?? 0);
      if (sortKey === 'cmc')      cmp = (a.cmc ?? 0) - (b.cmc ?? 0);
      if (sortKey === 'rarity')   cmp = (a.rarity || '').localeCompare(b.rarity || '');
      if (sortKey === 'type')     cmp = (a.typeLine || '').localeCompare(b.typeLine || '');
      if (sortKey === 'colors')   cmp = (a.colors?.length ?? 0) - (b.colors?.length ?? 0);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [localCards, search, sortKey, sortAsc, priceTier, qtyFilter, selectedSet,
      selectedColors, selectedTypes, selectedRarities, selectedCmc, legendaryOnly]);

  const activeFilterCount = [
    selectedColors.length > 0, selectedTypes.length > 0,
    selectedRarities.length > 0, selectedCmc.length > 0,
    priceTier !== 'all', qtyFilter !== 'all', !!selectedSet, legendaryOnly,
  ].filter(Boolean).length;

  function clearAllFilters() {
    setSelectedColors([]); setSelectedTypes([]); setSelectedRarities([]);
    setSelectedCmc([]); setPriceTier('all'); setQtyFilter('all'); setSelectedSet('');
    setLegendaryOnly(false);
  }

  const totalValue = localCards.reduce((s, c) => s + c.quantity * (c.priceUsd ?? 0), 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  return (
    <div className="space-y-4">

      {/* Summary + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-4 text-sm flex-1">
          <span className="text-zinc-500">
            <span className="text-zinc-100 font-semibold">{localCards.length}</span> unique
          </span>
          <span className="text-zinc-500">
            <span className="text-zinc-100 font-semibold">{totalCards}</span> total
          </span>
          {totalValue > 0 && (
            <span className="text-zinc-500">
              ~<span className="text-amber-400 font-semibold">${totalValue.toFixed(2)}</span> value
            </span>
          )}
          {detectedFormat && detectedFormat !== 'Unknown' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
              {detectedFormat}
            </span>
          )}
        </div>

        {/* View + Zoom controls */}
        <div className="flex gap-2">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`px-3 py-1.5 transition-colors ${view === 'grid' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              className={`px-3 py-1.5 transition-colors ${view === 'table' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Table
            </button>
          </div>

          {/* Card zoom (only in grid view) */}
          {view === 'grid' && (
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setCardZoom('sm')}
                title="Smaller cards"
                className={`px-2.5 py-1.5 transition-colors ${cardZoom === 'sm' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                ⊟
              </button>
              <button
                type="button"
                onClick={() => setCardZoom('md')}
                title="Medium cards"
                className={`px-2.5 py-1.5 transition-colors ${cardZoom === 'md' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                ◯
              </button>
              <button
                type="button"
                onClick={() => setCardZoom('lg')}
                title="Larger cards"
                className={`px-2.5 py-1.5 transition-colors ${cardZoom === 'lg' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                ⊕
              </button>
            </div>
          )}
        </div>

        {/* Add card quick search */}
        <QuickAddCard onAdd={handleAdd} onCollectionChange={() => onCollectionChange?.({ collectionCards: localCards, collectionSize: localCards.length, totalCards, detectedFormat: detectedFormat ?? '' })} />
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search your collection…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
      />

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="space-y-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">

        {/* Color */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 w-10 shrink-0">Color</span>
          <div className="flex flex-wrap gap-3">
            {COLORS.map((c) => (
              <Tip key={c.id} label={c.label}>
                <button type="button"
                  onClick={() => setSelectedColors(toggleItem(selectedColors, c.id))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColors.includes(c.id) ? `${c.bg} ${c.border} scale-110 ring-2 ring-offset-2 ring-offset-zinc-900` : `${c.bg} border-zinc-700 hover:scale-105 opacity-70 hover:opacity-100`
                  }`}
                  aria-label={c.label}
                />
              </Tip>
            ))}
          </div>
        </div>

        {/* Card type */}
        <FilterRow label="Type">
          {CARD_TYPES.map((t) => (
            <Pill key={t} active={selectedTypes.includes(t)} title={`Filter by ${t}`}
              onClick={() => setSelectedTypes(toggleItem(selectedTypes, t))}>{t}</Pill>
          ))}
          <Pill active={legendaryOnly} onClick={() => setLegendaryOnly((v) => !v)} title="Show legendary creatures only">
            👑 Legendary Creatures
          </Pill>
        </FilterRow>

        {/* Rarity */}
        <FilterRow label="Rarity">
          {RARITIES.map((r) => {
            const on = selectedRarities.includes(r.id);
            return (
              <Tip key={r.id} label={r.title}>
                <button type="button"
                  onClick={() => setSelectedRarities(toggleItem(selectedRarities, r.id))}
                  className={`w-7 h-7 rounded text-xs font-black border transition-colors ${
                    on ? `${r.color} bg-zinc-800` : 'border-zinc-700 text-zinc-600 hover:text-zinc-400'
                  }`}
                >{r.label}</button>
              </Tip>
            );
          })}
        </FilterRow>

        {/* CMC / Mana Value */}
        <FilterRow label="CMC">
          {CMC_OPTIONS.map((v) => (
            <Pill key={String(v)} active={selectedCmc.includes(v)}
              title={v === '6+' ? 'Mana value 6 or more' : `Mana value ${v}`}
              onClick={() => setSelectedCmc(toggleItem(selectedCmc, v))}>{String(v)}</Pill>
          ))}
        </FilterRow>

        {/* Price + Copies + Collection Type + Set */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 border-t border-zinc-800">
          <FilterRow label="Price">
            {PRICE_TIERS.map(({ id, label }) => (
              <Pill key={id} active={priceTier === id}
                title={id === 'all' ? 'Any price' : `Price: ${label}`}
                onClick={() => setPriceTier(id)}>{label}</Pill>
            ))}
          </FilterRow>

          <FilterRow label="Copies">
            {([['all','Any','Any quantity'],['singles','×1','Exactly 1 copy'],['multiples','×2+','2 or more copies']] as [QtyFilter,string,string][]).map(([id, label, tip]) => (
              <Pill key={id} active={qtyFilter === id} title={tip} onClick={() => setQtyFilter(id)}>{label}</Pill>
            ))}
          </FilterRow>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-zinc-500">Set</span>
            <select value={selectedSet} onChange={(e) => setSelectedSet(e.target.value)}
              title="Filter by set" aria-label="Filter by set"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 max-w-40"
            >
              <option value="">All sets</option>
              {setOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <button type="button" onClick={clearAllFilters}
            className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors pt-1"
          >
            Clear all filters ({activeFilterCount} active)
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-zinc-600 py-8">
          {search || activeFilterCount > 0 ? 'No cards match these filters.' : 'No cards found.'}
        </p>
      )}

      {/* Grid view */}
      {view === 'grid' && filtered.length > 0 && (
        <div className={`grid gap-3 ${
          cardZoom === 'sm' ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8' :
          cardZoom === 'lg' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' :
          'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
        }`}>
          {filtered.map((card) => (
            <div
              key={card.name}
              className="group relative block text-left hover:cursor-pointer"
              onClick={() => setPreviewCard(card)}
              onMouseEnter={() => setHoveredCard(card)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <img
                src={card.imageUrl ?? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image&version=normal`}
                alt={card.name}
                className="w-full rounded-lg border border-zinc-700 group-hover:border-amber-400 transition-colors"
                onError={e => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  img.nextElementSibling?.removeAttribute('hidden');
                }}
              />
              <div hidden className="w-full aspect-[63/88] rounded-lg border border-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center p-2 group-hover:border-amber-400 transition-colors">
                <span className="text-zinc-400 text-xs text-center leading-tight font-medium"><CardNameLink name={card.name} imageUrl={null} /></span>
              </div>
              {/* Quantity badge */}
              <span className="absolute top-1 right-1 bg-black/80 text-white text-xs font-bold px-1.5 py-0.5 rounded" title="Quantity owned">
                ×{card.quantity}
              </span>
              {/* Price badge */}
              {card.priceUsd !== null && card.priceUsd > 0 && (
                <span className="absolute bottom-1 left-1 bg-black/80 text-amber-400 text-xs font-medium px-1.5 py-0.5 rounded" title="Price per card">
                  ${card.priceUsd.toFixed(2)}
                </span>
              )}
              {/* Rules hint indicator */}
              {getRulesHint(card.typeLine) && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setHoveredRulesHint(getRulesHint(card.typeLine)); }}
                  onMouseEnter={(e) => { e.preventDefault(); setHoveredRulesHint(getRulesHint(card.typeLine)); }}
                  onMouseLeave={() => setHoveredRulesHint(null)}
                  title="Rules tip available"
                  className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-blue-600/80 text-white text-xs flex items-center justify-center hover:bg-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  ⚡
                </button>
              )}
              {/* Remove button — appears on hover */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(card.name); }}
                disabled={removingName === card.name}
                title={`Remove ${card.name}`}
                className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-600/80 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {view === 'table' && filtered.length > 0 && (
        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="text-left px-3 py-3 text-zinc-400 font-medium w-8">#</th>
                <th className="text-left px-3 py-3 min-w-40">
                  <button type="button" onClick={() => toggleSort('name')} className="text-zinc-400 hover:text-zinc-200 font-medium">
                    Card{sortIcon('name')}
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-zinc-400 font-medium hidden lg:table-cell">Type</th>
                <th className="text-center px-3 py-3 hidden md:table-cell w-12">
                  <button type="button" onClick={() => toggleSort('colors')} className="text-zinc-400 hover:text-zinc-200 font-medium" title="Colors">
                    C{sortIcon('colors')}
                  </button>
                </th>
                <th className="text-right px-3 py-3 hidden lg:table-cell w-12">
                  <button type="button" onClick={() => toggleSort('cmc')} className="text-zinc-400 hover:text-zinc-200 font-medium" title="Converted Mana Cost (total mana to cast)">
                    CMC{sortIcon('cmc')}
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-zinc-400 font-medium hidden lg:table-cell w-24">Rarity</th>
                <th className="text-right px-3 py-3">
                  <button type="button" onClick={() => toggleSort('quantity')} className="text-zinc-400 hover:text-zinc-200 font-medium">
                    Qty{sortIcon('quantity')}
                  </button>
                </th>
                <th className="text-right px-3 py-3">
                  <button type="button" onClick={() => toggleSort('price')} className="text-zinc-400 hover:text-zinc-200 font-medium">
                    Price{sortIcon('price')}
                  </button>
                </th>
                <th className="px-2 py-3 w-8 text-zinc-400 font-medium">Act</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((card, i) => (
                <tr
                  key={card.name}
                  className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/40 transition-colors"
                  onMouseEnter={() => setHoveredCard(card)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <td className="px-3 py-2.5 text-zinc-600 tabular-nums text-xs">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setPreviewCard(card)}
                      className="text-zinc-200 hover:text-amber-400 transition-colors font-medium"
                    >
                      {card.name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500 hidden lg:table-cell text-xs">{card.typeLine ? card.typeLine.split('—')[0].trim() : '—'}</td>
                  <td className="px-3 py-2.5 text-center hidden md:table-cell">
                    <div className="flex gap-0.5 justify-center" title={card.colors && card.colors.length > 0 ? card.colors.map(c => COLORS.find(x => x.id === c)?.label).filter(Boolean).join(', ') : 'Colorless'}>
                      {(card.colors || []).map(c => {
                        const colorObj = COLORS.find(x => x.id === c);
                        return colorObj ? (
                          <div key={c} className={`w-4 h-4 rounded-full ${colorObj.bg}`} title={colorObj.label} />
                        ) : null;
                      })}
                      {(!card.colors || card.colors.length === 0) && <span className="text-xs text-zinc-500" title="Colorless">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right hidden lg:table-cell tabular-nums">{card.cmc ?? '—'}</td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-xs">
                    {card.rarity ? (
                      <span className="px-2 py-1 rounded-full bg-zinc-800 text-zinc-400 capitalize cursor-help" title={card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}>
                        {card.rarity[0].toUpperCase()}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">×{card.quantity}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {card.priceUsd !== null && card.priceUsd > 0
                      ? <span className="text-zinc-300">${card.priceUsd.toFixed(2)}</span>
                      : <span className="text-zinc-600">—</span>
                    }
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(card.name)}
                      disabled={removingName === card.name}
                      title={`Remove ${card.name}`}
                      className="text-zinc-700 hover:text-red-400 transition-colors text-sm disabled:opacity-40"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td colSpan={4} className="px-3 py-3 text-zinc-500 text-sm">{filtered.length} cards shown</td>
                <td className="px-3 py-3 text-right text-zinc-300 text-sm tabular-nums">
                  {filtered.reduce((s, c) => s + c.quantity, 0)} total
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Hover preview tooltip (grid only) */}
      {view === 'grid' && hoveredCard && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl w-56 text-sm space-y-1">
            <p className="text-zinc-100 font-semibold leading-snug">{hoveredCard.name}</p>
            {hoveredCard.setName && <p className="text-zinc-500">{hoveredCard.setName}</p>}
            <div className="flex justify-between pt-1">
              <span className="text-zinc-400">Owned: <span className="text-zinc-200">×{hoveredCard.quantity}</span></span>
              {hoveredCard.priceUsd !== null && hoveredCard.priceUsd > 0 && (
                <span className="text-amber-400 font-medium">${hoveredCard.priceUsd.toFixed(2)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rules hint tooltip */}
      {hoveredRulesHint && (
        <div className="fixed bottom-6 left-6 z-50 pointer-events-none">
          <div className="bg-blue-900 border border-blue-700 rounded-xl p-3 shadow-2xl w-64 text-sm">
            <p className="text-blue-100"><span className="font-semibold">💡 Rules tip:</span> {hoveredRulesHint}</p>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {previewCard && (
        <CardDetailModal
          cardName={previewCard.name}
          collectionCard={previewCard}
          onClose={() => setPreviewCard(null)}
          decks={decks}
          onCollectionChange={() => {
            fetch('/api/collection/saved')
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (data) onCollectionChange?.(data); })
              .catch(() => {});
          }}
        />
      )}

    </div>
  );
}
