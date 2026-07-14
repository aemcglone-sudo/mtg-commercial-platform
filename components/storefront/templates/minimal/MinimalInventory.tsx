'use client';

import { useState, useCallback, useRef } from 'react';
import type { ShopSite } from '@/components/storefront/types';

const CONDITION_LABEL: Record<string, string> = {
 NM:'Near Mint', LP:'Lightly Played', MP:'Moderately Played',
 HP:'Heavily Played', DMG:'Damaged',
};
const CATEGORY_LABELS: Record<string, string> = {
 booster_box:'Booster Box', collector_box:'Collector Box', bundle:'Bundle',
 commander_precon:'Commander Precon', prerelease_kit:'Prerelease Kit',
 starter_deck:'Starter Deck', sleeve:'Sleeves', deck_box:'Deck Box',
 playmat:'Playmat', dice:'Dice', binder:'Binder', storage_box:'Storage',
 other_sealed:'Sealed', other_accessory:'Accessory',
};

interface SearchItem {
 id: string; cardName: string; condition: string; foil: boolean;
 priceCents: number; quantity: number; setCode: string; rarity: string | null; imageUrl: string | null;
}

type Props = {
 inventory: ShopSite['inventory'];
 products: ShopSite['products'];
 slug: string;
};

export default function MinimalInventory({ inventory, products, slug }: Props) {
 const [search, setSearch] = useState('');
 const [results, setResults] = useState<SearchItem[]>([]);
 const [searching, setSearching] = useState(false);
 const [searched, setSearched] = useState(false);
 const [selected, setSelected] = useState<SearchItem | null>(null);
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const doSearch = useCallback(async (q: string) => {
 if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
 setSearching(true);
 try {
 const res = await fetch(`/api/storefront/${slug}/inventory?q=${encodeURIComponent(q)}`);
 const data = await res.json() as { items: SearchItem[] };
 setResults(data.items ?? []);
 setSearched(true);
 } finally { setSearching(false); }
 }, [slug]);

 function handleSearch(val: string) {
 setSearch(val);
 if (debounceRef.current) clearTimeout(debounceRef.current);
 debounceRef.current = setTimeout(() => doSearch(val), 300);
 }

 return (
 <section className="max-w-3xl mx-auto px-6 py-10 border-b border-zinc-100 space-y-8">

 {/* Products */}
 {products.length > 0 && (
 <div>
 <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Products</h2>
 <div className="divide-y divide-zinc-100">
 {products.map(p => (
 <div key={p.id} className="flex items-center justify-between py-3 gap-3">
 <div className="flex items-center gap-3 min-w-0">
 {p.imageUrl
 ? <img src={p.imageUrl} alt="" className="w-8 h-8 object-contain rounded shrink-0" />
 : <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center text-sm shrink-0">📦</div>
 }
 <div className="min-w-0">
 <p className="text-sm font-medium text-zinc-900 truncate">{p.name}</p>
 <p className="text-xs text-zinc-500">{CATEGORY_LABELS[p.category] ?? p.category} · Qty {p.quantity}</p>
 </div>
 </div>
 <p className="text-sm font-semibold text-zinc-900 shrink-0">${(p.priceCents / 100).toFixed(2)}</p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Singles search */}
 <div>
 <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Singles</h2>

 <div className="relative mb-4">
 <input
 type="text"
 value={search}
 onChange={e => handleSearch(e.target.value)}
 placeholder="Search for a card…"
 className="w-full border border-zinc-300 rounded-lg px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors bg-white"
 />
 {searching && (
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 animate-pulse">searching…</span>
 )}
 {search && !searching && (
 <button type="button" onClick={() => { setSearch(''); setResults([]); setSearched(false); }}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">✕</button>
 )}
 </div>

 {/* Results as clean list */}
 {searched && results.length > 0 && (
 <div className="divide-y divide-zinc-100">
 {results.map(item => (
 <button key={item.id + item.condition} type="button" onClick={() => setSelected(item)}
 className="w-full flex items-center justify-between py-3 text-left hover:bg-zinc-50 -mx-2 px-2 rounded transition-colors">
 <div>
 <span className="text-sm font-medium text-zinc-900">{item.cardName}</span>
 {item.foil && <span className="ml-2 text-xs text-purple-500">Foil</span>}
 <p className="text-xs text-zinc-500 mt-0.5">
 {item.setCode?.toUpperCase()} · {CONDITION_LABEL[item.condition] ?? item.condition}
 </p>
 </div>
 <div className="text-right shrink-0 ml-4">
 <p className="text-sm font-semibold text-zinc-900">${(item.priceCents / 100).toFixed(2)}</p>
 <p className="text-xs text-zinc-400">×{item.quantity}</p>
 </div>
 </button>
 ))}
 </div>
 )}

 {searched && results.length === 0 && !searching && (
 <p className="text-sm text-zinc-500">
 &ldquo;{search}&rdquo; isn&rsquo;t in this shop&rsquo;s inventory. Contact the shop to request it.
 </p>
 )}

 {!searched && (
 <p className="text-xs text-zinc-400">
 {inventory.length > 0 ? `${inventory.length}+ singles available.` :'Singles available.'} Search to find a specific card.
 </p>
 )}
 </div>

 {/* Card detail modal */}
 {selected && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
 onClick={() => setSelected(null)}>
 <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-sm w-full shadow-xl flex gap-4"
 onClick={e => e.stopPropagation()}>
 {selected.imageUrl && (
 <img src={selected.imageUrl} alt={selected.cardName} className="w-28 rounded-xl shrink-0 object-cover border border-zinc-100" />
 )}
 <div className="flex-1 min-w-0 space-y-3">
 <p className="font-semibold text-zinc-900 leading-snug">{selected.cardName}</p>
 {selected.setCode && <p className="text-xs text-zinc-400 uppercase tracking-wide">{selected.setCode}</p>}
 <div className="space-y-1.5 text-sm divide-y divide-zinc-100">
 <div className="flex justify-between pt-1">
 <span className="text-zinc-500">Price</span>
 <span className="font-semibold text-zinc-900">${(selected.priceCents / 100).toFixed(2)}</span>
 </div>
 <div className="flex justify-between pt-1">
 <span className="text-zinc-500">Condition</span>
 <span className="text-zinc-700">{CONDITION_LABEL[selected.condition] ?? selected.condition}</span>
 </div>
 {selected.foil && (
 <div className="flex justify-between pt-1">
 <span className="text-zinc-500">Foil</span>
 <span className="text-purple-600">✦ Yes</span>
 </div>
 )}
 <div className="flex justify-between pt-1">
 <span className="text-zinc-500">In Stock</span>
 <span className="text-zinc-700">{selected.quantity}</span>
 </div>
 </div>
 <button type="button" onClick={() => setSelected(null)}
 className="w-full text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg py-1.5 transition-colors mt-2">
 Close
 </button>
 </div>
 </div>
 </div>
 )}
 </section>
 );
}
