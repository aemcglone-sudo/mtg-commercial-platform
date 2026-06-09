'use client';

import { useState, useRef } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';

export default function LocationPermission({
  onLocationChange,
  valueProp = 'We use your location to find nearby Magic stores and tournaments.',
  showManualFallback = true,
}) {
  const { latitude, longitude, accuracy, error, loading, permissionState, requestLocation } = useGeolocation();
  const [manualZipCode, setManualZipCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const zipInputRef = useRef(null);

  // Call parent callback when location changes
  if (latitude && longitude && onLocationChange) {
    onLocationChange({ latitude, longitude, accuracy });
  }

  const handleRequestLocation = () => {
    requestLocation();
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualZipCode.trim()) return;

    setManualLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualZipCode)}`
      );
      const results = await res.json();

      if (results && results.length > 0) {
        const location = {
          latitude: parseFloat(results[0].lat),
          longitude: parseFloat(results[0].lon),
          accuracy: null,
        };
        if (onLocationChange) {
          onLocationChange(location);
        }
      }
    } catch (err) {
      console.error('Error fetching location:', err);
    } finally {
      setManualLoading(false);
    }
  };

  // Unsupported state
  if (permissionState === 'unsupported') {
    return (
      <div
        className="rounded-lg border border-red-900 bg-red-950/30 p-4"
        role="alert"
        aria-label="Geolocation not supported"
      >
        <p className="text-sm text-red-600 mb-3">
          ❌ Geolocation is not supported in your browser. Please enter your location manually.
        </p>
        {showManualFallback && (
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <input
              ref={zipInputRef}
              type="text"
              placeholder="e.g., Atlanta, GA or 30328"
              value={manualZipCode}
              onChange={(e) => setManualZipCode(e.target.value)}
              aria-label="Enter your city or zip code"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualZipCode.trim() || manualLoading}
              className="w-full px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {manualLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
        )}
      </div>
    );
  }

  // Permission denied state
  if (permissionState === 'denied') {
    return (
      <div
        className="rounded-lg border border-amber-900 bg-amber-950/30 p-4"
        role="alert"
        aria-label="Location permission denied"
      >
        <p className="text-sm text-amber-600 mb-3">
          ⚠️ {error}
        </p>
        {showManualFallback && (
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <p className="text-xs text-zinc-400 mb-2">Enter your location as a fallback:</p>
            <input
              ref={zipInputRef}
              type="text"
              placeholder="e.g., Atlanta, GA or 30328"
              value={manualZipCode}
              onChange={(e) => setManualZipCode(e.target.value)}
              aria-label="Enter your city or zip code"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualZipCode.trim() || manualLoading}
              className="w-full px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {manualLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
        )}
      </div>
    );
  }

  // Success state
  if (permissionState === 'granted' && latitude && longitude) {
    return (
      <div
        className="rounded-lg border border-green-900 bg-green-950/30 p-4"
        role="status"
        aria-label="Location detected"
      >
        <p className="text-sm text-green-600">
          ✓ Location detected ({latitude.toFixed(4)}°, {longitude.toFixed(4)}°)
          {accuracy && <span className="text-xs text-green-500 ml-2">Accuracy: ±{accuracy.toFixed(0)}m</span>}
        </p>
      </div>
    );
  }

  // Prompt state (initial)
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
      <p className="text-sm text-zinc-300">{valueProp}</p>
      <button
        onClick={handleRequestLocation}
        disabled={loading}
        aria-label="Request location permission"
        className="w-full px-4 py-2 bg-amber-400 text-black rounded-lg font-medium text-sm hover:bg-amber-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            Requesting location...
          </>
        ) : (
          <>
            📍 Allow Location
          </>
        )}
      </button>

      {showManualFallback && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-zinc-900 text-zinc-500">or</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <input
              ref={zipInputRef}
              type="text"
              placeholder="e.g., Atlanta, GA or 30328"
              value={manualZipCode}
              onChange={(e) => setManualZipCode(e.target.value)}
              aria-label="Enter your city or zip code"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualZipCode.trim() || manualLoading}
              className="w-full px-3 py-2 bg-zinc-800 text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {manualLoading ? 'Searching...' : 'Search Location'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
