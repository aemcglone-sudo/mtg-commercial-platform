'use client';

import { useState } from 'react';

interface LocationResult {
  lat: number;
  lng: number;
  city: string;
  state: string;
  zip: string;
}

interface Props {
  onLocation: (result: LocationResult) => void;
}

export default function LocationPrompt({ onLocation }: Props) {
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleZip(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) { setError('Enter a valid 5-digit zip code'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/local-play/geocode?zip=${zip}`);
      if (!res.ok) { setError('Zip code not found'); return; }
      const data = await res.json() as LocationResult;
      onLocation(data);
    } catch {
      setError('Failed to look up zip code');
    } finally {
      setLoading(false);
    }
  }

  function handleGPS() {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setGpsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Reverse geocode with a simple approach — zip lookup by coords
        onLocation({ lat, lng, city: 'Your Location', state: '', zip: '' });
        setGpsLoading(false);
      },
      () => {
        setError('Could not get your location. Try entering a zip code.');
        setGpsLoading(false);
      }
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-4xl mb-4">🗺️</div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Find your local MTG scene</h2>
        <p className="text-zinc-400 text-sm mb-8">
          Discover nearby stores, upcoming events, and cards available in your area.
        </p>

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGPS}
            disabled={gpsLoading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-zinc-900 font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {gpsLoading ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <span>📍</span>
            )}
            {gpsLoading ? 'Getting location…' : 'Use my current location'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-700" />
            <span className="text-zinc-500 text-sm">or</span>
            <div className="flex-1 h-px bg-zinc-700" />
          </div>

          <form onSubmit={handleZip} className="flex gap-2">
            <input
              type="text"
              value={zip}
              onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Enter zip code"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              maxLength={5}
            />
            <button
              type="submit"
              disabled={loading || zip.length !== 5}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              {loading ? '…' : 'Go'}
            </button>
          </form>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    </div>
  );
}
