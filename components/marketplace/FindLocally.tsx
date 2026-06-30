'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import HoldRequestModal from './HoldRequestModal';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

interface CardResult {
  inventoryId: string;
  cardName: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  address: string;
  phone: string;
  holdInstructions: string;
  condition: string;
  foil: boolean;
  quantity: number;
  priceCents: number;
  imageUrl: string;
  setCode: string;
  setName?: string;
  collectorNumber?: string;
  distanceMiles: number;
  shopLat?: number;
  shopLng?: number;
  collectorLat?: number;
  collectorLng?: number;
}

interface SearchResult {
  inventoryId: string;
  cardName: string;
  scryfallId: string;
  setCode: string;
  setName?: string;
  collectorNumber?: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  quantity: number;
  imageUrl: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  shopLat: number;
  shopLng: number;
  distanceMiles: number;
}

interface Props {
  initialCard?: string; // scryfallId to search on mount
  initialShop?: string;
}

const CONDITION_COLOR: Record<string, string> = {
  NM: 'text-emerald-400', LP: 'text-green-400', MP: 'text-yellow-400',
  HP: 'text-orange-400', DMG: 'text-red-400',
};
const CONDITION_LABEL: Record<string, string> = {
  NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played',
  HP: 'Heavily Played', DMG: 'Damaged',
};

export default function FindLocally({ initialCard }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [resolvedName, setResolvedName] = useState(''); // canonical name after selection
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cardResults, setCardResults] = useState<CardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'zip' | null>(null);
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState(50);
  const [holdItem, setHoldItem] = useState<CardResult | null>(null);
  const [holdSuccess, setHoldSuccess] = useState('');
  const [activeShopName, setActiveShopName] = useState<string | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setNameCache = useRef<Record<string, string>>({});

  // Load location from prefs
  useEffect(() => {
    fetch('/api/marketplace/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((prefs: { lat: number | null; lng: number | null; searchRadiusMiles: number } | null) => {
        if (prefs?.lat && prefs?.lng) {
          setLocation({ lat: prefs.lat, lng: prefs.lng });
          setLocationMethod('gps');
          if (prefs.searchRadiusMiles) setRadius(prefs.searchRadiusMiles);
        }
      })
      .catch(() => {});
  }, []);

  // Scryfall autocomplete
  useEffect(() => {
    if (resolvedName) { setSuggestions([]); return; } // already resolved, no autocomplete
    if (query.length < 2) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json() as { data: string[] };
          setSuggestions((data.data ?? []).slice(0, 8));
        }
      } catch { /* ignore */ }
    }, 250);
  }, [query, resolvedName]);

  // Search for initial card on mount once location is set
  useEffect(() => {
    if (initialCard && location) searchCard(initialCard);
  }, [initialCard, location]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectSuggestion(name: string) {
    setQuery(name);
    setResolvedName(name);
    setSuggestions([]);
    // Auto-search on selection
    if (location) searchByName(name);
  }

  function requestGPS() {
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationMethod('gps');
      },
      () => alert('Could not get your location. Try entering a zip code.')
    );
  }

  async function setByZip() {
    if (!/^\d{5}$/.test(zip)) return;
    const res = await fetch(`/api/marketplace/geocode?zip=${zip}`);
    if (!res.ok) { alert('Invalid zip code'); return; }
    const data = await res.json() as { lat: number; lng: number };
    setLocation(data);
    setLocationMethod('zip');
    fetch('/api/marketplace/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: data.lat, lng: data.lng }),
    }).catch(() => {});
  }

  async function searchByName(name: string) {
    if (!location) return;
    setLoading(true);
    setResults([]);
    setCardResults([]);
    const res = await fetch(`/api/marketplace/search?q=${encodeURIComponent(name)}&lat=${location.lat}&lng=${location.lng}&radius=${radius}`);
    if (res.ok) {
      const data = await res.json() as { results: SearchResult[] };
      await resolveSetNames(data.results.map(r => r.setCode).filter(Boolean));
      setResults(data.results.map(r => ({ ...r, setName: setNameCache.current[r.setCode] })));
    }
    setLoading(false);
  }

  function handleSearch() {
    if (!location || query.length < 2) return;
    // If user typed something without selecting a suggestion, search as-is
    setResolvedName(query);
    setSuggestions([]);
    searchByName(query);
  }

  async function resolveSetNames(codes: string[]): Promise<void> {
    const unknown = [...new Set(codes)].filter(c => c && !setNameCache.current[c]);
    await Promise.all(unknown.map(async code => {
      try {
        const r = await fetch(`https://api.scryfall.com/sets/${code.toLowerCase()}`);
        if (r.ok) {
          const d = await r.json() as { name: string };
          setNameCache.current[code] = d.name;
        }
      } catch { /* ignore */ }
    }));
  }

  async function searchCard(scryfallId: string) {
    if (!location) return;
    setLoading(true);
    setCardResults([]);
    const res = await fetch(`/api/marketplace/find/card/${scryfallId}?lat=${location.lat}&lng=${location.lng}&radius=${radius}`);
    if (res.ok) {
      const data = await res.json() as { results: CardResult[] };
      await resolveSetNames(data.results.map(r => r.setCode).filter(Boolean));
      setCardResults(data.results.map(r => ({ ...r, setName: setNameCache.current[r.setCode] })));
    }
    setLoading(false);
  }

  // Location setup screen
  if (!location) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6">
        <div className="text-4xl">📍</div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Find cards at local shops</h2>
          <p className="text-zinc-500 text-sm">We need your location to show nearby stores.</p>
        </div>
        <button
          type="button"
          onClick={requestGPS}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
        >
          Use my location
        </button>
        <div className="flex items-center gap-2 max-w-xs mx-auto">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-600">or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <div className="flex gap-2 max-w-xs mx-auto">
          <input
            type="text"
            value={zip}
            onChange={e => setZip(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setByZip()}
            placeholder="Enter zip code"
            maxLength={5}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button type="button" onClick={setByZip} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-medium transition-colors">Go</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar with autocomplete */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setResolvedName(''); setResults([]); setCardResults([]); }}
              onKeyDown={e => { if (e.key === 'Enter') { setSuggestions([]); handleSearch(); } if (e.key === 'Escape') setSuggestions([]); }}
              placeholder="Search for a card…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden z-50 shadow-xl max-h-52 overflow-y-auto">
                {suggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); selectSuggestion(name); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors block"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            aria-label="Search radius"
            value={radius}
            onChange={e => setRadius(parseInt(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
          >
            <option value={10}>10 mi</option>
            <option value={25}>25 mi</option>
            <option value={50}>50 mi</option>
            <option value={100}>100 mi</option>
          </select>
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || query.length < 2}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '…' : 'Search'}
          </button>
        </div>
        <p className="text-xs text-zinc-600">
          📍 {locationMethod === 'zip' ? `Zip ${zip}` : 'Your location'} · {radius} mile radius
          <button type="button" onClick={() => setLocation(null)} className="ml-2 text-zinc-500 hover:text-zinc-300 underline">Change</button>
        </p>
      </div>

      {holdSuccess && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3 text-sm text-emerald-300">
          ✅ {holdSuccess}
        </div>
      )}

      {/* Side-by-side: cards left, map right */}
      {(results.length > 0 || cardResults.length > 0) && location ? (
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* Card results list */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Card-specific results (scryfallId deeplink) */}
            {cardResults.length > 0 && (
              <>
                <h3 className="font-semibold text-zinc-100">Available nearby</h3>
                {cardResults.map(r => (
                  <div
                    key={r.inventoryId}
                    onMouseEnter={() => setActiveShopName(r.shopName)}
                    onMouseLeave={() => setActiveShopName(undefined)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 transition-colors hover:border-zinc-600 cursor-default"
                  >
                    {r.imageUrl && <img src={r.imageUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-400 truncate">📍 {r.shopName}</p>
                      {r.address && <p className="text-xs text-zinc-500 truncate">{r.address}</p>}
                      <p className="text-xs text-zinc-500">{r.distanceMiles} mi away</p>
                      <p className={`text-xs mt-0.5 ${CONDITION_COLOR[r.condition] ?? 'text-zinc-400'}`}>{CONDITION_LABEL[r.condition] ?? r.condition}{r.foil ? ' · Foil' : ' · Non-foil'}</p>
                      {r.setName && <p className="text-xs text-zinc-600">{r.setName}{r.collectorNumber ? ` #${r.collectorNumber}` : ''}</p>}
                    </div>
                    <div className="shrink-0 text-right space-y-1.5">
                      <p className="text-amber-400 font-semibold">${(r.priceCents / 100).toFixed(2)}</p>
                      <p className="text-xs text-zinc-600">Qty: {r.quantity}</p>
                      <button type="button" onClick={() => setHoldItem({ ...r, collectorLat: location?.lat, collectorLng: location?.lng })} className="block px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">Hold</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Name search results */}
            {results.length > 0 && (
              <>
                <h3 className="font-semibold text-zinc-100">{results.length} result{results.length !== 1 ? 's' : ''} for <span className="text-zinc-400 font-normal">"{resolvedName}"</span></h3>
                {results.map(r => (
                  <div
                    key={r.inventoryId}
                    onMouseEnter={() => setActiveShopName(r.shopName)}
                    onMouseLeave={() => setActiveShopName(undefined)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3 transition-colors hover:border-zinc-600 cursor-default"
                  >
                    {r.imageUrl && <img src={r.imageUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-100 text-sm truncate">{r.cardName}</p>
                      {r.setName && <p className="text-xs text-zinc-500">{r.setName}{r.collectorNumber ? ` #${r.collectorNumber}` : ''}</p>}
                      <p className="text-sm font-semibold text-emerald-400 truncate mt-0.5">📍 {r.shopName}</p>
                      <p className="text-xs text-zinc-500">{r.distanceMiles} mi away</p>
                      <p className={`text-xs ${CONDITION_COLOR[r.condition] ?? 'text-zinc-400'}`}>{CONDITION_LABEL[r.condition] ?? r.condition}{r.foil ? ' · Foil' : ' · Non-foil'}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-amber-400 font-semibold">${(r.priceCents / 100).toFixed(2)}</p>
                      <button
                        type="button"
                        onClick={() => setHoldItem({
                          inventoryId: r.inventoryId, shopId: r.shopId, shopName: r.shopName,
                          shopSlug: r.shopSlug, address: '', phone: '', holdInstructions: '',
                          cardName: r.cardName, condition: r.condition, foil: r.foil,
                          quantity: r.quantity, priceCents: r.priceCents, imageUrl: r.imageUrl,
                          setCode: r.setCode, setName: r.setName, distanceMiles: r.distanceMiles,
                          shopLat: r.shopLat, shopLng: r.shopLng,
                          collectorLat: location?.lat, collectorLng: location?.lng,
                        })}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        Hold
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Sticky map on the right */}
          <div className="w-full lg:w-80 lg:sticky lg:top-4 shrink-0">
            <MapView
              activePinLabel={activeShopName}
              pins={[
                { lat: location.lat, lng: location.lng, label: 'You', isUser: true },
                ...results
                  .filter((r, i, a) => a.findIndex(x => x.shopId === r.shopId) === i)
                  .filter(r => !isNaN(r.shopLat) && !isNaN(r.shopLng))
                  .map(r => ({ lat: r.shopLat, lng: r.shopLng, label: r.shopName, popup: `<strong>${r.shopName}</strong><br/>${r.distanceMiles} mi away` })),
                ...cardResults
                  .filter(r => r.address)
                  .map(r => ({ lat: 0, lng: 0, label: r.shopName }))
                  .filter(p => p.lat !== 0),
              ].filter(p => !isNaN(p.lat) && !isNaN(p.lng))}
              className="h-64 lg:h-96"
            />
            {activeShopName && (
              <p className="text-xs text-center text-zinc-500 mt-2">📍 {activeShopName}</p>
            )}
          </div>
        </div>
      ) : null}

      {!loading && results.length === 0 && cardResults.length === 0 && resolvedName && (
        <div className="text-center py-8 space-y-4">
          <p className="text-zinc-500 text-sm">
            No local shops have <span className="text-zinc-300">&ldquo;{resolvedName}&rdquo;</span> within {radius} miles.
            {radius < 100 && <> <button type="button" onClick={() => setRadius(r => Math.min(r * 2, 100))} className="underline text-zinc-400 hover:text-zinc-200">Expand radius</button>.</>}
          </p>
          <div className="border border-zinc-800 rounded-xl p-5 space-y-3 max-w-sm mx-auto text-left">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Buy it online instead</p>
            <a
              href={`https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(resolvedName)}&view=grid`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors group"
            >
              <span className="text-sm text-zinc-200 font-medium">TCGplayer</span>
              <span className="text-xs text-zinc-500 group-hover:text-zinc-300">Search →</span>
            </a>
            <a
              href={`https://www.cardkingdom.com/catalog/search?search=header&filter[name]=${encodeURIComponent(resolvedName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors group"
            >
              <span className="text-sm text-zinc-200 font-medium">Card Kingdom</span>
              <span className="text-xs text-zinc-500 group-hover:text-zinc-300">Search →</span>
            </a>
          </div>
        </div>
      )}

      {holdItem && (
        <HoldRequestModal
          item={{ inventoryId: holdItem.inventoryId, shopId: holdItem.shopId, shopName: holdItem.shopName, cardName: holdItem.cardName, condition: holdItem.condition, foil: holdItem.foil, priceCents: holdItem.priceCents, holdInstructions: holdItem.holdInstructions, setName: holdItem.setName, shopLat: holdItem.shopLat, shopLng: holdItem.shopLng, collectorLat: holdItem.collectorLat, collectorLng: holdItem.collectorLng }}
          onClose={() => setHoldItem(null)}
          onSuccess={() => {
            setHoldItem(null);
            setHoldSuccess(`Hold requested for ${holdItem.cardName} at ${holdItem.shopName}. They'll confirm within 24 hours.`);
          }}
        />
      )}
    </div>
  );
}
