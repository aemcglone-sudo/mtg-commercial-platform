'use client';

import { useState, useEffect } from 'react';
import HoldRequestModal from './HoldRequestModal';

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
  distanceMiles: number;
}

interface SearchResult {
  inventoryId: string;
  cardName: string;
  scryfallId: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  quantity: number;
  imageUrl: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  distanceMiles: number;
}

interface Props {
  initialCard?: string; // scryfallId to search on mount
  initialShop?: string;
}

export default function FindLocally({ initialCard, initialShop }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cardResults, setCardResults] = useState<CardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'zip' | null>(null);
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState(50);
  const [holdItem, setHoldItem] = useState<CardResult | null>(null);
  const [holdSuccess, setHoldSuccess] = useState('');

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

  // Search for initial card
  useEffect(() => {
    if (initialCard && location) searchCard(initialCard);
  }, [initialCard, location]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Save to prefs
    fetch('/api/marketplace/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: data.lat, lng: data.lng }),
    }).catch(() => {});
  }

  async function search() {
    if (!location || query.length < 2) return;
    setLoading(true);
    setResults([]);
    setCardResults([]);
    const res = await fetch(`/api/marketplace/search?q=${encodeURIComponent(query)}&lat=${location.lat}&lng=${location.lng}&radius=${radius}`);
    if (res.ok) {
      const data = await res.json() as { results: SearchResult[] };
      setResults(data.results);
    }
    setLoading(false);
  }

  async function searchCard(scryfallId: string) {
    if (!location) return;
    setLoading(true);
    setCardResults([]);
    const res = await fetch(`/api/marketplace/find/card/${scryfallId}?lat=${location.lat}&lng=${location.lng}&radius=${radius}`);
    if (res.ok) {
      const data = await res.json() as { results: CardResult[] };
      setCardResults(data.results);
    }
    setLoading(false);
  }

  const conditionColor = (c: string) =>
    ({ NM: 'text-emerald-400', LP: 'text-green-400', MP: 'text-yellow-400', HP: 'text-orange-400', DMG: 'text-red-400' }[c] ?? 'text-zinc-400');

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
          <button
            type="button"
            onClick={setByZip}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
          >
            Go
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search for a card…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <select
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
          onClick={search}
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

      {holdSuccess && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3 text-sm text-emerald-300">
          ✅ {holdSuccess}
        </div>
      )}

      {/* Card-specific results */}
      {cardResults.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-zinc-100">{cardResults[0]?.shopName ? `Results` : ''}</h3>
          {cardResults.map(r => (
            <div key={r.inventoryId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
              {r.imageUrl && <img src={r.imageUrl} alt="" className="w-10 h-14 object-cover rounded" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-100 text-sm">{r.shopName}</p>
                    <p className="text-xs text-zinc-500">{r.address}</p>
                    <p className="text-xs text-zinc-600">{r.distanceMiles} miles away</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-amber-400 font-semibold">${(r.priceCents / 100).toFixed(2)}</p>
                    <p className={`text-xs ${conditionColor(r.condition)}`}>{r.condition}{r.foil ? ' Foil' : ''}</p>
                    <p className="text-xs text-zinc-600">Qty: {r.quantity}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHoldItem(r)}
                className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Hold
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Name search results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-zinc-100">{results.length} result{results.length !== 1 ? 's' : ''}</h3>
          {results.map(r => (
            <div key={r.inventoryId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
              {r.imageUrl && <img src={r.imageUrl} alt="" className="w-10 h-14 object-cover rounded" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-100 text-sm truncate">{r.cardName}</p>
                <p className="text-xs text-zinc-400">{r.shopName} · {r.distanceMiles} mi</p>
                <p className={`text-xs ${conditionColor(r.condition)}`}>{r.condition}{r.foil ? ' · Foil' : ''}</p>
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
                    setCode: '', distanceMiles: r.distanceMiles,
                  })}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Hold
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && cardResults.length === 0 && query.length >= 2 && (
        <p className="text-zinc-600 text-sm text-center py-8">No results found within {radius} miles. Try expanding your radius.</p>
      )}

      {holdItem && (
        <HoldRequestModal
          item={{ inventoryId: holdItem.inventoryId, shopId: holdItem.shopId, shopName: holdItem.shopName, cardName: holdItem.cardName, condition: holdItem.condition, foil: holdItem.foil, priceCents: holdItem.priceCents, holdInstructions: holdItem.holdInstructions }}
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
