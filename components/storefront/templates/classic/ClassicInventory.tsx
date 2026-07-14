'use client';

import { useState, useCallback, useRef } from 'react';
import type { ShopSite } from '@/components/storefront/types';
import HoldRequestModal from '@/components/storefront/HoldRequestModal';

const CONDITION_COLOR: Record<string, string> = {
 NM:'text-emerald-500', LP:'text-green-400', MP:'text-yellow-400',
 HP:'text-orange-400', DMG:'text-red-400',
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
 isLight?: boolean;
 shop: ShopSite['shop'];
};

export default function ClassicInventory({ inventory, products, slug, isLight, shop }: Props) {
 const [search, setSearch] = useState('');
 const [results, setResults] = useState<SearchItem[]>([]);
 const [searching, setSearching] = useState(false);
 const [searched, setSearched] = useState(false);
 const [selected, setSelected] = useState<SearchItem | null>(null);
 const [holdItem, setHoldItem] = useState<SearchItem | null>(null);
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const doSearch = useCallback(async (q: string) => {
 if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
 setSearching(true);
 try {
 const res = await fetch(`/api/storefront/${slug}/inventory?q=${encodeURIComponent(q)}`);
 const data = await res.json() as { items: SearchItem[] };
 setResults(data.items ?? []);
 setSearched(true);
 } finally {
 setSearching(false);
 }
 }, [slug]);

 function handleSearch(val: string) {
 setSearch(val);
 if (debounceRef.current) clearTimeout(debounceRef.current);
 debounceRef.current = setTimeout(() => doSearch(val), 300);
 }

 const headCls = isLight ?'text-zinc-900':'text-zinc-100';
 const cardBg = isLight ?'bg-zinc-50 border-zinc-200':'bg-zinc-900 border-zinc-800';
 const inputCls = isLight
 ?'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500'
 :'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500';
 const mutedCls = isLight ?'text-zinc-500':'text-zinc-600';

 return (
 <section className="px-6 py-6 space-y-8">

 {/* Products */}
 {products.length > 0 && (
 <div>
 <h2 className="text-lg font-semibold mb-4" style={{ color: shop.themePrimaryHex }}>Products</h2>
 <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
 {products.map(p => (
 <div key={p.id} className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${cardBg}`}>
 {p.imageUrl
 ? <img src={p.imageUrl} alt="" className="w-10 h-10 object-contain rounded shrink-0" />
 : <div className={`w-10 h-10 rounded flex items-center justify-center text-lg shrink-0 ${isLight ?'bg-zinc-100':'bg-zinc-800'}`}>📦</div>
 }
 <div className="flex-1 min-w-0">
 <p className={`text-sm font-medium truncate ${headCls}`}>{p.name}</p>
 <p className={`text-xs ${mutedCls}`}>{CATEGORY_LABELS[p.category] ?? p.category} · Qty {p.quantity}</p>
 {p.notes && <p className={`text-xs truncate ${mutedCls}`}>{p.notes}</p>}
 </div>
 <p className="font-semibold text-sm shrink-0" style={{ color: shop.themePrimaryHex }}>${(p.priceCents / 100).toFixed(2)}</p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Singles search */}
 <div>
 <h2 className="text-lg font-semibold mb-4" style={{ color: shop.themePrimaryHex }}>Singles</h2>
 <div className="relative mb-4">
 <input
 type="text"
 value={search}
 onChange={e => handleSearch(e.target.value)}
 placeholder="Search for a card…"
 className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors ${inputCls}`}
 />
 {search && (
 <button type="button" onClick={() => { setSearch(''); setResults([]); setSearched(false); }}
 className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${mutedCls} hover:text-zinc-400`}>✕</button>
 )}
 {searching && (
 <span className={`absolute right-8 top-1/2 -translate-y-1/2 text-xs ${mutedCls} animate-pulse`}>…</span>
 )}
 </div>

 {searched && results.length > 0 && (
 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
 {results.map(item => (
 <button key={item.id + item.condition} type="button" onClick={() => setSelected(item)}
 className="text-left space-y-1 group">
 <div className={`relative rounded-xl overflow-hidden border aspect-[63/88] ${isLight ?'bg-zinc-100 border-zinc-200':'bg-zinc-800 border-zinc-700'} transition-colors`}
 style={{ ['--tw-border-opacity'as string]:'1'}}
 onMouseEnter={e => (e.currentTarget.style.borderColor = shop.themePrimaryHex +'99')}
 onMouseLeave={e => (e.currentTarget.style.borderColor='')}>
 {item.imageUrl
 ? <img src={item.imageUrl} alt={item.cardName} className="w-full h-full object-cover" />
 : <div className={`w-full h-full flex items-center justify-center text-xs p-2 text-center ${mutedCls}`}>{item.cardName}</div>
 }
 <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
 <p className="text-xs font-semibold" style={{ color: shop.themePrimaryHex }}>${(item.priceCents / 100).toFixed(2)}</p>
 </div>
 </div>
 <p className={`text-[11px] truncate ${isLight ?'text-zinc-700':'text-zinc-400'}`}>{item.cardName}</p>
 <p className={`text-[10px] ${CONDITION_COLOR[item.condition] ?? mutedCls}`}>{item.condition}{item.foil ?'· Foil':''}</p>
 </button>
 ))}
 </div>
 )}

 {searched && results.length === 0 && !searching && (
 <div className={`border rounded-xl px-5 py-5 text-center space-y-1 ${cardBg}`}>
 <p className={`text-sm ${isLight ?'text-zinc-600':'text-zinc-400'}`}>"{search}" isn't in this shop's inventory.</p>
 <p className={`text-xs ${mutedCls}`}>Contact the shop to request it.</p>
 </div>
 )}

 {!searched && (
 <p className={`text-xs ${mutedCls}`}>{inventory.length > 0 ? `${inventory.length}+ singles available.` :'Singles available.'} Search to find a specific card.</p>
 )}
 </div>

 {/* Card detail modal */}
 {selected && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setSelected(null)}>
 <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-sm w-full flex gap-4 shadow-2xl" onClick={e => e.stopPropagation()}>
 {selected.imageUrl && (
 <img src={selected.imageUrl} alt={selected.cardName} className="w-32 rounded-xl shrink-0 object-cover" />
 )}
 <div className="flex-1 min-w-0 space-y-2">
 <p className="text-base font-semibold text-zinc-100 leading-tight">{selected.cardName}</p>
 {selected.setCode && <p className="text-xs text-zinc-500 uppercase">{selected.setCode}</p>}
 <div className="space-y-1 text-sm">
 <div className="flex justify-between">
 <span className="text-zinc-500">Price</span>
 <span className="font-semibold" style={{ color: shop.themePrimaryHex }}>${(selected.priceCents / 100).toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-zinc-500">Condition</span>
 <span className={CONDITION_COLOR[selected.condition] ??'text-zinc-300'}>{selected.condition}</span>
 </div>
 {selected.foil && (
 <div className="flex justify-between">
 <span className="text-zinc-500">Foil</span>
 <span className="text-purple-400">✦ Yes</span>
 </div>
 )}
 <div className="flex justify-between">
 <span className="text-zinc-500">In Stock</span>
 <span className="text-zinc-300">{selected.quantity}</span>
 </div>
 </div>
 <button type="button"
 onClick={() => { setHoldItem(selected); setSelected(null); }}
 className="mt-2 w-full text-sm font-medium rounded-lg py-2 transition-colors text-white"
 style={{ backgroundColor: shop.themePrimaryHex }}>
 Request Hold
 </button>
 <button type="button" onClick={() => setSelected(null)}
 className="mt-1.5 w-full text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-lg py-1.5 transition-colors">
 Close
 </button>
 </div>
 </div>
 </div>
 )}

 {holdItem && (
 <HoldRequestModal
 item={{ ...holdItem, cardName: holdItem.cardName }}
 slug={slug}
 isLight={isLight}
 accentHex={shop.themePrimaryHex}
 onClose={() => setHoldItem(null)}
 />
 )}
 </section>
 );
}
