'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CardNameLink } from '@/components/CardNameLink';
import CardDetailModal from './CardDetailModal';
import { getRulesHint } from '@/lib/rules-hints';

// ─── Column config ────────────────────────────────────────────────────────
type ColKey = 'set' | 'type' | 'colors' | 'cmc' | 'rarity' | 'foil' | 'condition' | 'qty' | 'price' | 'tcg' | 'tcgFoil' | 'cm' | 'cmFoil';
interface ColDef { key: ColKey; label: string; defaultOn: boolean }
const ALL_COLS: ColDef[] = [
  { key: 'set',      label: 'Set',         defaultOn: true  },
  { key: 'type',     label: 'Type',        defaultOn: true  },
  { key: 'colors',   label: 'Colors',      defaultOn: true  },
  { key: 'cmc',      label: 'CMC',         defaultOn: true  },
  { key: 'rarity',   label: 'Rarity',      defaultOn: true  },
  { key: 'foil',     label: 'Foil',        defaultOn: false },
  { key: 'condition',label: 'Condition',   defaultOn: true  },
  { key: 'qty',      label: 'Qty',         defaultOn: true  },
  { key: 'price',    label: 'My Price',    defaultOn: true  },
  { key: 'tcg',      label: 'TCG ($)',     defaultOn: true  },
  { key: 'tcgFoil',  label: 'TCG Foil',   defaultOn: true  },
  { key: 'cm',       label: 'CM (€)',      defaultOn: true  },
  { key: 'cmFoil',   label: 'CM Foil',    defaultOn: true  },
];
const DEFAULT_COLS = new Set<ColKey>(ALL_COLS.filter(c => c.defaultOn).map(c => c.key));

export interface ShopItem {
  id: string;
  cardName: string;
  setCode: string;
  condition: string;
  foil: boolean;
  quantity: number;
  priceCents: number;
  imageUrl: string | null;
  scryfallId: string;
  typeLine: string | null;
  colors: string | null; // JSON string
  cmc: number | null;
  rarity: string | null;
}

// Parsed, display-ready version (colors as array)
interface DisplayItem extends Omit<ShopItem, 'colors'> {
  colors: string[];
  priceUsd: number;
  marketCents: number | null; // filled in after market fetch
}

// ─── Filter constants (same as CollectionBrowser) ─────────────────────────
const COLORS = [
  { id: 'W', label: 'White',     bg: 'bg-yellow-50',   text: 'text-yellow-900', border: 'border-yellow-300' },
  { id: 'U', label: 'Blue',      bg: 'bg-blue-600',    text: 'text-white',      border: 'border-blue-700' },
  { id: 'B', label: 'Black',     bg: 'bg-zinc-700',    text: 'text-zinc-100',   border: 'border-zinc-600' },
  { id: 'R', label: 'Red',       bg: 'bg-red-600',     text: 'text-white',      border: 'border-red-700' },
  { id: 'G', label: 'Green',     bg: 'bg-green-700',   text: 'text-white',      border: 'border-green-800' },
  { id: 'C', label: 'Colorless', bg: 'bg-zinc-500',    text: 'text-white',      border: 'border-zinc-600' },
  { id: 'M', label: 'Multicolor (Gold)', bg: 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500', text: 'text-amber-900', border: 'border-amber-500' },
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

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
const PRICE_TIERS = [
  { id: 'all', label: 'Any' }, { id: 'under1', label: '< $1' },
  { id: '1to10', label: '$1–10' }, { id: '10to50', label: '$10–50' }, { id: 'over50', label: '$50+' },
] as const;
type PriceTier = typeof PRICE_TIERS[number]['id'];
const CMC_OPTIONS = [0, 1, 2, 3, 4, 5, '6+'] as const;
type CmcOption = typeof CMC_OPTIONS[number];
type SortKey = 'name' | 'price' | 'quantity' | 'cmc' | 'rarity' | 'condition';
type ViewMode = 'grid' | 'table';

// ─── Helpers ──────────────────────────────────────────────────────────────
function parseColors(raw: string | null): string[] {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function getColorGroup(colors: string[]): ColorId {
  if (!colors.length) return 'C';
  if (colors.length > 1) return 'M';
  return (colors[0] ?? 'C') as ColorId;
}
function getCardType(typeLine: string | null): string | null {
  if (!typeLine) return null;
  for (const t of CARD_TYPES) if (typeLine.includes(t)) return t;
  return null;
}
function matchesPriceTier(price: number, tier: PriceTier) {
  if (tier === 'all') return true;
  if (tier === 'under1')  return price < 1;
  if (tier === '1to10')   return price >= 1 && price < 10;
  if (tier === '10to50')  return price >= 10 && price < 50;
  if (tier === 'over50')  return price >= 50;
  return true;
}
function matchesCmc(cmc: number | null, sel: CmcOption[]) {
  if (!sel.length) return true;
  const c = cmc ?? 0;
  return sel.some(s => s === '6+' ? c >= 6 : c === s);
}
function toggleArr<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}
function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
        active ? 'bg-amber-400 text-black font-medium' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
      }`}>{children}</button>
  );
}
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-zinc-500 w-10 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

// ─── Inline edit cell ─────────────────────────────────────────────────────
function EditablePrice({ item, onSave }: { item: DisplayItem; onSave: (cents: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState((item.priceCents / 100).toFixed(2));
  function commit() {
    setEditing(false);
    const n = Math.round(parseFloat(val) * 100);
    if (!isNaN(n) && n >= 0 && n !== item.priceCents) onSave(n);
    else setVal((item.priceCents / 100).toFixed(2));
  }
  if (editing) return (
    <input type="number" min={0} step={0.01} value={val} autoFocus
      title="Price" placeholder="0.00"
      onChange={e => setVal(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setVal((item.priceCents / 100).toFixed(2)); } }}
      className="w-20 bg-zinc-800 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none"
    />
  );
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-amber-400 hover:text-amber-300 hover:bg-zinc-800 rounded px-1 py-0.5 text-xs transition-colors">
      {fmt(item.priceCents)}
    </button>
  );
}

function EditableQty({ item, onSave }: { item: DisplayItem; onSave: (qty: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(item.quantity));
  function commit() {
    setEditing(false);
    const n = parseInt(val);
    if (!isNaN(n) && n > 0 && n !== item.quantity) onSave(n);
    else setVal(String(item.quantity));
  }
  if (editing) return (
    <input type="number" min={1} value={val} autoFocus
      title="Quantity" placeholder="1"
      onChange={e => setVal(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setVal(String(item.quantity)); } }}
      className="w-14 bg-zinc-800 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none"
    />
  );
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 rounded px-1 py-0.5 text-xs transition-colors">
      ×{item.quantity}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
interface Props {
  items: ShopItem[];
  onRefresh: () => void;
}

export default function ShopInventoryBrowser({ items: rawItems, onRefresh }: Props) {
  const [view, setView] = useState<ViewMode>('table');
  const [cardZoom, setCardZoom] = useState<'sm' | 'md' | 'lg'>('md');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedColors, setSelectedColors] = useState<ColorId[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<CardType[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<Rarity[]>([]);
  const [selectedCmc, setSelectedCmc] = useState<CmcOption[]>([]);
  const [priceTier, setPriceTier] = useState<PriceTier>('all');
  const [conditionFilter, setConditionFilter] = useState('');
  const [legendaryOnly, setLegendaryOnly] = useState(false);
  const [selectedSet, setSelectedSet] = useState('');
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  const [setNames, setSetNames] = useState<Record<string, string>>({});

  // Fetch set code→name map from Scryfall once
  useEffect(() => {
    fetch('https://api.scryfall.com/sets', { headers: { 'User-Agent': 'Grimoire/1.0' } })
      .then(r => r.json())
      .then((d: { data: Array<{ code: string; name: string }> }) => {
        const map: Record<string, string> = {};
        for (const s of d.data) map[s.code.toUpperCase()] = s.name;
        setSetNames(map);
      })
      .catch(() => {});
  }, []);

  const [enriched, setEnriched] = useState<Record<string, { typeLine: string; colors: string[]; cmc: number; imageUrl: string | null }>>({});

  // Local enrichment cache: scryfallId → { typeLine, colors, cmc, imageUrl }
  // Normalize card names for matching (strips apostrophes/punctuation so "Praetors Voice" matches "Praetors' Voice")
  function normName(s: string) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }

  // Enrich inventory items missing type/color/cmc — fetch from Scryfall browser-side, update state immediately
  // Falls back to name-based lookup for items with unrecognized/fake Scryfall IDs
  useEffect(() => {
    const needsEnrich = [...new Map(
      rawItems
        .filter(i => i.scryfallId && (!i.typeLine || !i.colors || i.cmc == null || !i.imageUrl) && !enriched[i.scryfallId])
        .map(i => [i.scryfallId, i])
    ).values()];
    if (needsEnrich.length === 0) return;

    type ScryfallCardMeta = { id: string; name: string; type_line: string; colors: string[]; cmc: number; image_uris?: { normal?: string; border_crop?: string }; card_faces?: Array<{ image_uris?: { normal?: string; border_crop?: string } }> };
    const CHUNK = 75;

    async function scryfallPost(identifiers: object[]): Promise<ScryfallCardMeta[]> {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers }),
      });
      if (!res.ok) return [];
      const d = await res.json() as { data: ScryfallCardMeta[] };
      return d.data ?? [];
    }

    (async () => {
      for (let i = 0; i < needsEnrich.length; i += CHUNK) {
        const chunk = needsEnrich.slice(i, i + CHUNK);
        try {
          const patch: Record<string, { typeLine: string; colors: string[]; cmc: number }> = {};

          function extractMeta(c: ScryfallCardMeta) {
            const img = c.image_uris?.border_crop ?? c.image_uris?.normal
              ?? c.card_faces?.[0]?.image_uris?.border_crop
              ?? c.card_faces?.[0]?.image_uris?.normal
              ?? null;
            return { typeLine: c.type_line, colors: c.colors, cmc: c.cmc, imageUrl: img };
          }

          // Step 1: try by ID
          const byIdResults = await scryfallPost(chunk.map(c => ({ id: c.scryfallId })));
          for (const c of byIdResults) patch[c.id] = extractMeta(c);

          // Step 2: name-based fallback for any that didn't resolve by ID
          const unresolved = chunk.filter(c => !patch[c.scryfallId]);
          if (unresolved.length > 0) {
            const uniqueNames = [...new Map(unresolved.map(c => [normName(c.cardName), c])).values()];
            const byNameResults = await scryfallPost(uniqueNames.map(c => ({ name: c.cardName })));
            for (const c of byNameResults) {
              const norm = normName(c.name);
              for (const item of unresolved.filter(u => normName(u.cardName) === norm)) {
                patch[item.scryfallId] = extractMeta(c);
              }
            }
          }

          if (Object.keys(patch).length > 0) {
            setEnriched(prev => ({ ...prev, ...(patch as typeof prev) }));
            fetch('/api/shops/inventory/enrich', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: Object.entries(patch).map(([scryfallId, v]) => ({ scryfallId, ...v })) }),
            }).catch(() => {});
          }
        } catch { /* ignore */ }
        if (i + CHUNK < needsEnrich.length) await new Promise(r => setTimeout(r, 110));
      }
    })();
  }, [rawItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch stale IDs once
  useEffect(() => {
    fetch('/api/shops/pricing/stale-ids')
      .then(r => r.json())
      .then((d: { ids: string[] }) => { if (d.ids) setStaleIds(new Set(d.ids)); })
      .catch(() => {});
  }, []);

    // Market prices (auto-loaded, always shown in table)
  const [marketPrices, setMarketPrices] = useState<Record<string, { usd: number | null; usdFoil: number | null; eur: number | null; eurFoil: number | null }>>({});
  const [marketLoading, setMarketLoading] = useState(false);
  // Keep vs-market toggle only for the grid overlay
  const [showMarketGrid, setShowMarketGrid] = useState(false);

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(DEFAULT_COLS);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setColPickerOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const col = (key: ColKey) => visibleCols.has(key);

  // Bulk selection (table only)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'flat' | 'pct'>('flat');
  const [bulkVal, setBulkVal] = useState('');

  // Saving state per item
  const [saving, setSaving] = useState<Set<string>>(new Set());

  // Preview modal
  const [previewItem, setPreviewItem] = useState<DisplayItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<DisplayItem | null>(null);

  // Parse items, merging in any browser-fetched enrichment data
  const items: DisplayItem[] = useMemo(() =>
    rawItems.map(item => {
      const e = item.scryfallId ? enriched[item.scryfallId] : undefined;
      return {
        ...item,
        typeLine: item.typeLine ?? e?.typeLine ?? null,
        colors: parseColors(item.colors ?? (e ? JSON.stringify(e.colors) : null)),
        cmc: item.cmc ?? e?.cmc ?? null,
        imageUrl: item.imageUrl ?? e?.imageUrl ?? null,
        priceUsd: item.priceCents / 100,
        marketCents: null,
      };
    }),
    [rawItems, enriched]
  );

  // Auto-fetch market prices whenever items change
  // Step 1: read DB cache; Step 2: fetch stale/missing from Scryfall directly in the browser
  useEffect(() => {
    if (items.length === 0) return;
    const ids = [...new Set(items.map(i => i.scryfallId).filter(Boolean) as string[])];
    const missing = ids.filter(id => !(id in marketPrices));
    if (missing.length === 0) return;

    setMarketLoading(true);

    fetch(`/api/shops/inventory/market-prices?ids=${missing.join(',')}`)
      .then(r => r.json())
      .then(async ({ prices, stale }: { prices: Record<string, { usd: number|null; usdFoil: number|null; eur: number|null; eurFoil: number|null }>; stale: string[] }) => {
        // Apply cached prices immediately
        if (Object.keys(prices).length > 0) {
          setMarketPrices(prev => ({ ...prev, ...prices }));
        }

        // Fetch from Scryfall for: stale/missing IDs + any cached IDs that lack EUR data
        const needFresh = [...new Set([
          ...stale,
          ...Object.entries(prices).filter(([, p]) => p.eur === null).map(([id]) => id),
        ])];
        if (needFresh.length === 0) return;
        const stale_ref = needFresh;

        // Build an id→name map for name-based fallback
        const idToName: Record<string, string> = {};
        for (const item of items) if (item.scryfallId) idToName[item.scryfallId] = item.cardName;

        type ScryfallPriceCard = { id: string; name: string; prices: { usd: string|null; usd_foil: string|null; eur: string|null; eur_foil: string|null } };

        function parseMarketPrice(p: ScryfallPriceCard['prices']) {
          return {
            usd:     p.usd      ? Math.round(parseFloat(p.usd)      * 100) : null,
            usdFoil: p.usd_foil ? Math.round(parseFloat(p.usd_foil) * 100) : null,
            eur:     p.eur      ? Math.round(parseFloat(p.eur)       * 100) : null,
            eurFoil: p.eur_foil ? Math.round(parseFloat(p.eur_foil)  * 100) : null,
          };
        }

        const CHUNK = 75;
        const freshPrices: Record<string, { usd: number|null; usdFoil: number|null; eur: number|null; eurFoil: number|null }> = {};

        for (let i = 0; i < stale_ref.length; i += CHUNK) {
          const chunk = stale_ref.slice(i, i + CHUNK);

          // Step 1: try by Scryfall ID
          try {
            const res = await fetch('https://api.scryfall.com/cards/collection', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
              body: JSON.stringify({ identifiers: chunk.map(id => ({ id })) }),
            });
            if (res.ok) {
              const data = await res.json() as { data: ScryfallPriceCard[] };
              for (const card of data.data) freshPrices[card.id] = parseMarketPrice(card.prices);
            }
          } catch { /* ignore */ }

          // Step 2: name-based fallback for any IDs that didn't resolve
          const unresolved = chunk.filter(id => !freshPrices[id] && idToName[id]);
          if (unresolved.length > 0) {
            try {
              const uniqueNames = [...new Map(unresolved.map(id => [normName(idToName[id]), idToName[id]])).values()];
              const nameRes = await fetch('https://api.scryfall.com/cards/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
                body: JSON.stringify({ identifiers: uniqueNames.map(name => ({ name })) }),
              });
              if (nameRes.ok) {
                const nameData = await nameRes.json() as { data: ScryfallPriceCard[] };
                for (const card of nameData.data) {
                  const norm = normName(card.name);
                  for (const id of unresolved.filter(id => normName(idToName[id]) === norm)) {
                    freshPrices[id] = parseMarketPrice(card.prices);
                  }
                }
              }
            } catch { /* ignore */ }
          }

          if (i + CHUNK < stale_ref.length) await new Promise(r => setTimeout(r, 110));
        }

        if (Object.keys(freshPrices).length > 0) {
          setMarketPrices(prev => ({ ...prev, ...freshPrices }));

          // Save to snapshots in background (fire and forget)
          fetch('/api/shops/inventory/market-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prices: freshPrices }),
          }).catch(() => {});
        }
      })
      .finally(() => setMarketLoading(false));
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of items) if (c.setCode) counts.set(c.setCode, (counts.get(c.setCode) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = items.filter(item => {
      if (q && !item.cardName.toLowerCase().includes(q)) return false;
      if (!matchesPriceTier(item.priceUsd, priceTier)) return false;
      if (conditionFilter && item.condition !== conditionFilter) return false;
      if (selectedSet && item.setCode !== selectedSet) return false;
      if (selectedColors.length) {
        const isColorless = item.colors.length === 0;
        const isMulti = item.colors.length > 1;
        const matches = selectedColors.some(sel => {
          if (sel === 'C') return isColorless;
          if (sel === 'M') return isMulti;
          return item.colors.includes(sel);
        });
        if (!matches) return false;
      }
      if (legendaryOnly && !item.typeLine?.includes('Legendary')) return false;
      if (selectedTypes.length) {
        const t = getCardType(item.typeLine);
        if (!t || !selectedTypes.includes(t as CardType)) return false;
      }
      if (selectedRarities.length && item.rarity && !selectedRarities.includes(item.rarity as Rarity)) return false;
      if (!matchesCmc(item.cmc, selectedCmc)) return false;
      if (showStaleOnly && !staleIds.has(item.id)) return false;
      return true;
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name')      cmp = a.cardName.localeCompare(b.cardName);
      if (sortKey === 'price')     cmp = a.priceCents - b.priceCents;
      if (sortKey === 'quantity')  cmp = a.quantity - b.quantity;
      if (sortKey === 'cmc')       cmp = (a.cmc ?? 0) - (b.cmc ?? 0);
      if (sortKey === 'rarity')    cmp = (a.rarity ?? '').localeCompare(b.rarity ?? '');
      if (sortKey === 'condition') cmp = (a.condition ?? '').localeCompare(b.condition ?? '');
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [items, search, priceTier, conditionFilter, selectedSet, selectedColors,
      legendaryOnly, selectedTypes, selectedRarities, selectedCmc, sortKey, sortAsc,
      showStaleOnly, staleIds]);

  // For grid: aggregate by cardName to show one tile per unique card
  const gridCards = useMemo(() => {
    const map = new Map<string, DisplayItem & { totalQty: number; priceRange: [number, number] }>();
    for (const item of filtered) {
      const ex = map.get(item.cardName);
      if (ex) {
        ex.totalQty += item.quantity;
        ex.priceRange[0] = Math.min(ex.priceRange[0], item.priceCents);
        ex.priceRange[1] = Math.max(ex.priceRange[1], item.priceCents);
      } else {
        map.set(item.cardName, { ...item, totalQty: item.quantity, priceRange: [item.priceCents, item.priceCents] });
      }
    }
    return [...map.values()];
  }, [filtered]);

  const activeFilterCount = [
    selectedColors.length > 0, selectedTypes.length > 0, selectedRarities.length > 0,
    selectedCmc.length > 0, priceTier !== 'all', !!conditionFilter, !!selectedSet, legendaryOnly,
  ].filter(Boolean).length;

  function clearAllFilters() {
    setSelectedColors([]); setSelectedTypes([]); setSelectedRarities([]);
    setSelectedCmc([]); setPriceTier('all'); setConditionFilter(''); setSelectedSet('');
    setLegendaryOnly(false);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  }
  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  // ── PATCH helper ──────────────────────────────────────────────────────
  async function patch(id: string, body: Record<string, string | number | boolean>) {
    setSaving(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/shops/inventory/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onRefresh();
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function deleteItem(id: string, name: string) {
    if (!confirm(`Remove ${name} from inventory?`)) return;
    await fetch(`/api/shops/inventory/${id}`, { method: 'DELETE' });
    onRefresh();
  }

  // ── Bulk actions ──────────────────────────────────────────────────────
  async function bulkReprice() {
    const ids = [...selected];
    for (const id of ids) {
      const item = filtered.find(i => i.id === id);
      if (!item) continue;
      let newCents: number;
      if (bulkMode === 'flat') {
        newCents = Math.round(parseFloat(bulkVal) * 100);
      } else {
        const pct = parseFloat(bulkVal.replace('%', '').replace('+', ''));
        newCents = Math.round(item.priceCents * (1 + pct / 100));
      }
      if (!isNaN(newCents) && newCents >= 0) {
        await fetch(`/api/shops/inventory/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceCents: newCents }),
        });
      }
    }
    setBulkOpen(false); setBulkVal('');
    onRefresh();
  }

  async function bulkRepriceToMarket() {
    const ids = [...selected];
    const missingIds = [...new Set(
      ids.map(id => filtered.find(i => i.id === id)?.scryfallId)
        .filter((id): id is string => !!id && !(id in marketPrices))
    )];
    let prices = { ...marketPrices };
    if (missingIds.length > 0) {
      // Check DB cache first
      const cacheRes = await fetch(`/api/shops/inventory/market-prices?ids=${missingIds.join(',')}`);
      const { prices: cached, stale } = await cacheRes.json() as {
        prices: Record<string, { usd: number | null; usdFoil: number | null; eur: number | null; eurFoil: number | null }>;
        stale: string[];
      };
      prices = { ...prices, ...cached };

      // Fetch stale/missing from Scryfall directly in the browser
      if (stale.length > 0) {
        const CHUNK = 75;
        for (let i = 0; i < stale.length; i += CHUNK) {
          const chunk = stale.slice(i, i + CHUNK);
          try {
            const res = await fetch('https://api.scryfall.com/cards/collection', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
              body: JSON.stringify({ identifiers: chunk.map(id => ({ id })) }),
            });
            if (res.ok) {
              const data = await res.json() as { data: Array<{ id: string; prices: { usd: string|null; usd_foil: string|null; eur: string|null; eur_foil: string|null } }> };
              const freshPrices: Record<string, { usd: number|null; usdFoil: number|null; eur: number|null; eurFoil: number|null }> = {};
              for (const card of data.data) {
                freshPrices[card.id] = {
                  usd:     card.prices.usd      ? Math.round(parseFloat(card.prices.usd)      * 100) : null,
                  usdFoil: card.prices.usd_foil ? Math.round(parseFloat(card.prices.usd_foil) * 100) : null,
                  eur:     card.prices.eur      ? Math.round(parseFloat(card.prices.eur)       * 100) : null,
                  eurFoil: card.prices.eur_foil ? Math.round(parseFloat(card.prices.eur_foil)  * 100) : null,
                };
                prices[card.id] = freshPrices[card.id];
              }
              // Save to snapshots in background
              if (Object.keys(freshPrices).length > 0) {
                fetch('/api/shops/inventory/market-prices', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prices: freshPrices }),
                }).catch(() => {});
              }
            }
          } catch { /* ignore chunk errors */ }
          if (i + CHUNK < stale.length) await new Promise(r => setTimeout(r, 110));
        }
      }

      setMarketPrices(prices);
    }
    for (const id of ids) {
      const item = filtered.find(i => i.id === id);
      if (!item) continue;
      const mktCents = prices[item.scryfallId]?.usd;
      if (mktCents != null) {
        await fetch(`/api/shops/inventory/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceCents: mktCents }),
        });
      }
    }
    onRefresh();
  }

  async function bulkDelete() {
    if (!confirm(`Remove ${selected.size} items from inventory?`)) return;
    await Promise.all([...selected].map(id => fetch(`/api/shops/inventory/${id}`, { method: 'DELETE' })));
    setSelected(new Set());
    onRefresh();
  }

  function exportCSV() {
    const rows = selected.size > 0 ? filtered.filter(i => selected.has(i.id)) : filtered;
    const blob = new Blob(
      ['Card,Set,Condition,Foil,Qty,Price\n' +
        rows.map(r => `"${r.cardName}",${r.setCode},${r.condition},${r.foil},${r.quantity},${r.priceUsd.toFixed(2)}`).join('\n')],
      { type: 'text/csv' }
    );
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inventory.csv'; a.click();
  }

  const totalValue = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id));

  function mktCell(cents: number | null | undefined, currency = '$'): React.ReactNode {
    if (cents == null) return <span className="text-zinc-700">—</span>;
    return <span className="text-zinc-400">{currency}{(cents / 100).toFixed(2)}</span>;
  }

  function vsDelta(priceCents: number, mktCents: number | null | undefined): React.ReactNode {
    if (mktCents == null) return null;
    const delta = ((priceCents - mktCents) / mktCents) * 100;
    if (Math.abs(delta) < 5) return <span className="text-zinc-600 text-[10px]">~</span>;
    return delta > 0
      ? <span className="text-green-400 text-[10px]">+{delta.toFixed(0)}%</span>
      : <span className="text-red-400 text-[10px]">{delta.toFixed(0)}%</span>;
  }

  return (
    <div className="space-y-4">

      {/* Summary + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-4 text-sm flex-1">
          <span className="text-zinc-500">
            <span className="text-zinc-100 font-semibold">{items.length}</span> listings
          </span>
          <span className="text-zinc-500">
            <span className="text-zinc-100 font-semibold">{items.reduce((s, i) => s + i.quantity, 0)}</span> total
          </span>
          {totalValue > 0 && (
            <span className="text-zinc-500">
              ~<span className="text-amber-400 font-semibold">${(totalValue / 100).toFixed(2)}</span> value
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {/* Grid/Table toggle */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden text-sm">
            <button type="button" onClick={() => setView('grid')}
              className={`px-3 py-1.5 transition-colors ${view === 'grid' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}>
              Grid
            </button>
            <button type="button" onClick={() => setView('table')}
              className={`px-3 py-1.5 transition-colors ${view === 'table' ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}>
              Table
            </button>
          </div>

          {view === 'grid' && (
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden text-sm">
              {(['sm', 'md', 'lg'] as const).map((z, _, arr) => (
                <button key={z} type="button" onClick={() => setCardZoom(z)}
                  className={`px-2.5 py-1.5 transition-colors ${cardZoom === z ? 'bg-amber-400 text-black font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}>
                  {z === 'sm' ? '⊟' : z === 'md' ? '◯' : '⊕'}
                </button>
              ))}
            </div>
          )}

          {view === 'grid' && (
            <button type="button" onClick={() => setShowMarketGrid(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors bg-zinc-900 ${showMarketGrid ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>
              vs. Market{marketLoading ? ' …' : ''}
            </button>
          )}
          {view === 'table' && marketLoading && (
            <span className="text-xs text-zinc-600 animate-pulse">Loading prices…</span>
          )}

          <button type="button" onClick={exportCSV}
            className="px-3 py-1.5 rounded-lg text-xs border border-zinc-700 text-zinc-500 hover:text-zinc-300 bg-zinc-900 transition-colors">
            CSV
          </button>

          {view === 'table' && (
            <div className="relative" ref={colPickerRef}>
              <button type="button" onClick={() => setColPickerOpen(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors bg-zinc-900 ${colPickerOpen ? 'border-amber-500 text-amber-400' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>
                Columns ▾
              </button>
              {colPickerOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 w-44 space-y-1">
                  {ALL_COLS.map(c => (
                    <label key={c.key} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-zinc-800 cursor-pointer">
                      <input type="checkbox" checked={visibleCols.has(c.key)} className="accent-amber-400"
                        onChange={() => setVisibleCols(prev => {
                          const next = new Set(prev);
                          next.has(c.key) ? next.delete(c.key) : next.add(c.key);
                          return next;
                        })} />
                      <span className="text-xs text-zinc-300">{c.label}</span>
                    </label>
                  ))}
                  <button type="button" onClick={() => setVisibleCols(DEFAULT_COLS)}
                    className="w-full text-[10px] text-zinc-600 hover:text-zinc-400 pt-1 transition-colors">
                    Reset to default
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <input type="search" placeholder="Search inventory…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
      />

      {/* Filters */}
      <div className="space-y-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
        {/* Color */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 w-10 shrink-0">Color</span>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
              <button key={c.id} type="button" title={c.label}
                onClick={() => setSelectedColors(toggleArr(selectedColors, c.id))}
                aria-label={c.label}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  selectedColors.includes(c.id)
                    ? `${c.bg} ${c.border} scale-110 ring-2 ring-offset-2 ring-offset-zinc-900`
                    : `${c.bg} border-zinc-700 hover:scale-105 opacity-70 hover:opacity-100`
                }`}
              />
            ))}
          </div>
        </div>
        <FilterRow label="Type">
          {CARD_TYPES.map(t => (
            <Pill key={t} active={selectedTypes.includes(t)} onClick={() => setSelectedTypes(toggleArr(selectedTypes, t))}>{t}</Pill>
          ))}
          <Pill active={legendaryOnly} onClick={() => setLegendaryOnly(v => !v)}>👑 Legendary</Pill>
        </FilterRow>
        <FilterRow label="Rarity">
          {RARITIES.map(r => (
            <button key={r.id} type="button" title={r.title}
              onClick={() => setSelectedRarities(toggleArr(selectedRarities, r.id))}
              className={`w-7 h-7 rounded text-xs font-black border transition-colors ${
                selectedRarities.includes(r.id) ? `${r.color} bg-zinc-800` : 'border-zinc-700 text-zinc-600 hover:text-zinc-400'
              }`}>
              {r.label}
            </button>
          ))}
        </FilterRow>
        <FilterRow label="CMC">
          {CMC_OPTIONS.map(v => (
            <Pill key={String(v)} active={selectedCmc.includes(v)} onClick={() => setSelectedCmc(toggleArr(selectedCmc, v))}>{String(v)}</Pill>
          ))}
        </FilterRow>
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 border-t border-zinc-800">
          <FilterRow label="Price">
            {PRICE_TIERS.map(({ id, label }) => (
              <Pill key={id} active={priceTier === id} onClick={() => setPriceTier(id)}>{label}</Pill>
            ))}
          </FilterRow>
          <FilterRow label="Cond">
            <Pill active={!conditionFilter} onClick={() => setConditionFilter('')}>Any</Pill>
            {CONDITIONS.map(c => (
              <Pill key={c} active={conditionFilter === c} onClick={() => setConditionFilter(c)}>{c}</Pill>
            ))}
          </FilterRow>
          <FilterRow label="">
            <Pill active={showStaleOnly} onClick={() => setShowStaleOnly(v => !v)}>
              ⚠ Stale{staleIds.size > 0 ? ` (${staleIds.size})` : ''}
            </Pill>
          </FilterRow>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <span className="text-xs text-zinc-500 w-10 shrink-0">Set</span>
          <select value={selectedSet} onChange={e => setSelectedSet(e.target.value)}
            title="Filter by set" aria-label="Filter by set"
            className="flex-1 max-w-sm bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-amber-500">
            <option value="">All sets</option>
            {setOptions.map(code => (
              <option key={code} value={code}>
                {setNames[code.toUpperCase()] ? `${setNames[code.toUpperCase()]} (${code.toUpperCase()})` : code.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        {activeFilterCount > 0 && (
          <button type="button" onClick={clearAllFilters}
            className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors pt-1">
            Clear all filters ({activeFilterCount} active)
          </button>
        )}
      </div>

      {/* Bulk toolbar (table only) */}
      {view === 'table' && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-amber-700/40 rounded-xl">
          <span className="text-xs text-amber-400 font-semibold">{selected.size} selected</span>
          {bulkOpen ? (
            <>
              <select title="Reprice mode" value={bulkMode} onChange={e => setBulkMode(e.target.value as 'flat' | 'pct')}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none">
                <option value="flat">Set price ($)</option>
                <option value="pct">% adjust</option>
              </select>
              <input type="text" placeholder={bulkMode === 'flat' ? '4.99' : '+10%'} value={bulkVal}
                onChange={e => setBulkVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && bulkReprice()}
                className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500" />
              <button type="button" onClick={bulkReprice} className="px-2 py-1 text-xs rounded-lg bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors">Apply</button>
              <button type="button" onClick={() => setBulkOpen(false)} className="px-2 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
            </>
          ) : (
            <button type="button" onClick={() => setBulkOpen(true)}
              className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors">Reprice…</button>
          )}
          <button type="button" onClick={bulkRepriceToMarket}
            className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors">
            Reprice to market
          </button>
          <a href="/shop/pricing?tab=wizard"
            className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors">
            Advanced Reprice…
          </a>
          <button type="button" onClick={bulkDelete}
            className="px-3 py-1 text-xs rounded-lg border border-red-900 text-red-400 hover:border-red-600 transition-colors ml-auto">
            Remove {selected.size}
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-zinc-600 py-8">
          {search || activeFilterCount > 0 ? 'No cards match these filters.' : 'No cards found.'}
        </p>
      )}

      {/* ── GRID VIEW ──────────────────────────────────────────────────── */}
      {view === 'grid' && filtered.length > 0 && (
        <div className={`grid gap-3 ${
          cardZoom === 'sm' ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8' :
          cardZoom === 'lg' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' :
          'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
        }`}>
          {gridCards.map(card => (
            <div key={card.cardName}
              className="group relative block text-left cursor-pointer"
              onClick={() => setPreviewItem(card)}
              onMouseEnter={() => setHoveredItem(card)}
              onMouseLeave={() => setHoveredItem(null)}>
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.cardName}
                  className="w-full rounded-lg border border-zinc-700 group-hover:border-amber-400 transition-colors" />
              ) : (
                <div className="w-full aspect-[63/88] rounded-lg border border-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center p-2 group-hover:border-amber-400 transition-colors">
                  <span className="text-zinc-400 text-xs text-center leading-tight font-medium">{card.cardName}</span>
                </div>
              )}
              {/* Qty badge */}
              <span className="absolute top-1 right-1 bg-black/80 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                ×{card.totalQty}
              </span>
              {/* Price badge */}
              <span className="absolute bottom-1 left-1 bg-black/80 text-amber-400 text-xs font-medium px-1.5 py-0.5 rounded">
                {card.priceRange[0] === card.priceRange[1]
                  ? fmt(card.priceRange[0])
                  : `${fmt(card.priceRange[0])}–${fmt(card.priceRange[1])}`
                }
              </span>
              {/* vs. Market overlay */}
              {showMarketGrid && (() => {
                const mkt = marketPrices[card.scryfallId]?.usd;
                if (mkt == null) return null;
                const delta = ((card.priceCents - mkt) / mkt) * 100;
                if (Math.abs(delta) < 5) return null;
                return (
                  <span className={`absolute top-1 left-1 bg-black/80 text-xs font-bold px-1.5 py-0.5 rounded ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                  </span>
                );
              })()}
              {/* Remove button */}
              <button type="button"
                onClick={e => { e.stopPropagation(); deleteItem(card.id, card.cardName); }}
                className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-600/80 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500"
                title={`Remove ${card.cardName}`}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* ── TABLE VIEW ─────────────────────────────────────────────────── */}
      {view === 'table' && filtered.length > 0 && (
        <div className="rounded-xl border border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" aria-label="Select all" checked={allSelected}
                    onChange={() => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(i => i.id)))}
                    className="accent-amber-400" />
                </th>
                <th className="text-left px-3 py-3 min-w-40">
                  <button type="button" onClick={() => toggleSort('name')} className="text-zinc-400 hover:text-zinc-200 font-medium">Card{sortIcon('name')}</button>
                </th>
                {col('set') && <th className="text-left px-3 py-3 text-zinc-400 font-medium whitespace-nowrap">Set</th>}
                {col('type') && <th className="text-left px-3 py-3 text-zinc-400 font-medium">Type</th>}
                {col('colors') && <th className="text-center px-3 py-3 text-zinc-400 font-medium w-12">C</th>}
                {col('cmc') && <th className="text-right px-3 py-3 w-12"><button type="button" onClick={() => toggleSort('cmc')} className="text-zinc-400 hover:text-zinc-200 font-medium">CMC{sortIcon('cmc')}</button></th>}
                {col('rarity') && <th className="text-left px-3 py-3 text-zinc-400 font-medium w-16">Rarity</th>}
                {col('foil') && <th className="text-center px-3 py-3 text-zinc-400 font-medium w-12">Foil</th>}
                {col('condition') && <th className="text-left px-3 py-3 text-zinc-400 font-medium w-20">Cond</th>}
                {col('qty') && <th className="text-right px-3 py-3"><button type="button" onClick={() => toggleSort('quantity')} className="text-zinc-400 hover:text-zinc-200 font-medium">Qty{sortIcon('quantity')}</button></th>}
                {col('price') && <th className="text-right px-3 py-3"><button type="button" onClick={() => toggleSort('price')} className="text-zinc-400 hover:text-zinc-200 font-medium">My Price{sortIcon('price')}</button></th>}
                {col('tcg') && <th className="text-right px-3 py-3 text-zinc-400 font-medium whitespace-nowrap">TCG ($)</th>}
                {col('tcgFoil') && <th className="text-right px-3 py-3 text-zinc-400 font-medium whitespace-nowrap">TCG Foil</th>}
                {col('cm') && <th className="text-right px-3 py-3 text-zinc-400 font-medium whitespace-nowrap">CM (€)</th>}
                {col('cmFoil') && <th className="text-right px-3 py-3 text-zinc-400 font-medium whitespace-nowrap">CM Foil</th>}
                <th className="px-2 py-3 w-8" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const mkt = marketPrices[item.scryfallId];
                return (
                  <tr key={item.id}
                    className={`border-b border-zinc-800/50 last:border-0 transition-colors ${selected.has(item.id) ? 'bg-amber-950/10' : 'hover:bg-zinc-800/40'} ${saving.has(item.id) ? 'opacity-60' : ''}`}
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" aria-label={`Select ${item.cardName}`} checked={selected.has(item.id)}
                        onChange={e => setSelected(prev => { const s = new Set(prev); e.target.checked ? s.add(item.id) : s.delete(item.id); return s; })}
                        className="accent-amber-400" />
                    </td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setPreviewItem(item)}
                        className="text-zinc-200 hover:text-amber-400 transition-colors font-medium text-left leading-tight">
                        {item.cardName}
                      </button>
                    </td>
                    {col('set') && (
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap" title={setNames[item.setCode.toUpperCase()] ?? item.setCode.toUpperCase()}>
                        <span className="text-zinc-400 font-mono font-semibold tracking-wide">{item.setCode.toUpperCase()}</span>
                      </td>
                    )}
                    {col('type') && (
                      <td className="px-3 py-2.5 text-zinc-500 text-xs max-w-36">
                        <span className="block truncate">{item.typeLine ? item.typeLine.split('—')[0].trim() : '—'}</span>
                      </td>
                    )}
                    {col('colors') && (
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex gap-0.5 justify-center">
                          {item.colors.length === 0
                            ? <div className="w-4 h-4 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 ring-1 ring-zinc-400" title="Colorless" />
                            : item.colors.length === 5
                              ? <div className={`w-4 h-4 rounded-full ${COLORS.find(x => x.id === 'M')!.bg} ring-1 ring-amber-500`} title="All Colors (Gold)" />
                              : item.colors.map(c => {
                                  const co = COLORS.find(x => x.id === c);
                                  return co ? <div key={c} className={`w-4 h-4 rounded-full ${co.bg}`} title={co.label} /> : null;
                                })
                          }
                        </div>
                      </td>
                    )}
                    {col('cmc') && <td className="px-3 py-2.5 text-right text-zinc-400 tabular-nums">{item.cmc ?? '—'}</td>}
                    {col('rarity') && (
                      <td className="px-3 py-2.5 text-xs">
                        {(() => {
                          const r = RARITIES.find(x => x.id === item.rarity);
                          return r
                            ? <span className={`px-2 py-1 rounded-full border bg-zinc-900 font-bold ${r.color}`} title={r.title}>{r.label}</span>
                            : <span className="text-zinc-600">—</span>;
                        })()}
                      </td>
                    )}
                    {col('foil') && (
                      <td className="px-3 py-2.5 text-center text-xs">
                        {item.foil ? <span className="text-purple-400">✦</span> : <span className="text-zinc-700">—</span>}
                      </td>
                    )}
                    {col('condition') && (
                      <td className="px-3 py-2.5">
                        <select title="Condition" value={item.condition}
                          onChange={e => patch(item.id, { condition: e.target.value })}
                          className="bg-transparent border border-zinc-700 rounded-md px-1.5 py-0.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer">
                          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                    )}
                    {col('qty') && (
                      <td className="px-3 py-2.5 text-right">
                        <EditableQty item={item} onSave={qty => patch(item.id, { quantity: qty })} />
                      </td>
                    )}
                    {col('price') && (
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {vsDelta(item.priceCents, mkt?.usd)}
                          <EditablePrice item={item} onSave={cents => patch(item.id, { priceCents: cents })} />
                        </div>
                      </td>
                    )}
                    {col('tcg') && <td className="px-3 py-2.5 text-right tabular-nums">{mktCell(mkt?.usd)}</td>}
                    {col('tcgFoil') && <td className="px-3 py-2.5 text-right tabular-nums">{mktCell(mkt?.usdFoil)}</td>}
                    {col('cm') && <td className="px-3 py-2.5 text-right tabular-nums">{mktCell(mkt?.eur, '€')}</td>}
                    {col('cmFoil') && <td className="px-3 py-2.5 text-right tabular-nums">{mktCell(mkt?.eurFoil, '€')}</td>}
                    <td className="px-2 py-2.5">
                      <button type="button" onClick={() => deleteItem(item.id, item.cardName)}
                        className="text-zinc-700 hover:text-red-400 transition-colors text-sm">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td colSpan={2} className="px-3 py-3 text-zinc-500 text-sm">{filtered.length} listings shown</td>
                <td colSpan={visibleCols.size + 1} className="px-3 py-3 text-right text-zinc-300 text-sm tabular-nums">
                  {filtered.reduce((s, i) => s + i.quantity, 0)} total · {fmt(filtered.reduce((s, i) => s + i.priceCents * i.quantity, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Hover preview (grid only) */}
      {view === 'grid' && hoveredItem && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl w-56 text-sm space-y-1">
            <p className="text-zinc-100 font-semibold leading-snug">{hoveredItem.cardName}</p>
            {hoveredItem.setCode && <p className="text-zinc-500">{hoveredItem.setCode} · {hoveredItem.condition}</p>}
            <div className="flex justify-between pt-1">
              <span className="text-zinc-400">In stock: <span className="text-zinc-200">×{hoveredItem.quantity}</span></span>
              <span className="text-amber-400 font-medium">{fmt(hoveredItem.priceCents)}</span>
            </div>
            {marketPrices[hoveredItem.scryfallId]?.usd != null && (
              <div className="text-xs text-zinc-500">TCG: {fmt(marketPrices[hoveredItem.scryfallId]!.usd!)}</div>
            )}
          </div>
        </div>
      )}

      {/* Card detail modal */}
      {previewItem && (
        <CardDetailModal
          cardName={previewItem.cardName}
          collectionCard={{
            name: previewItem.cardName,
            quantity: previewItem.quantity,
            priceUsd: previewItem.priceUsd,
            imageUrl: previewItem.imageUrl,
            scryfallUri: previewItem.scryfallId ? `https://scryfall.com/card/${previewItem.scryfallId}` : null,
            setName: previewItem.setCode,
            typeLine: previewItem.typeLine,
            colors: previewItem.colors,
            cmc: previewItem.cmc,
            rarity: previewItem.rarity,
            collectionType: 'paper',
          }}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
