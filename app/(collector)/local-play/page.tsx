'use client';

import { useEffect, useState } from 'react';
import LocationPrompt from '@/components/local-play/LocationPrompt';
import LocationHeader from '@/components/local-play/LocationHeader';
import SubTabStrip, { type LocalPlayTab } from '@/components/local-play/SubTabStrip';
import StoreList from '@/components/local-play/StoreList';
import EventList from '@/components/local-play/EventList';
import LocalCardSearch from '@/components/local-play/LocalCardSearch';

const PREFS_KEY = 'grimoire_local_play_prefs';

interface LocationPrefs {
  lat: number;
  lng: number;
  city: string;
  state: string;
  zip: string;
  radius_miles: number;
}

function loadPrefs(): LocationPrefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) as LocationPrefs : null;
  } catch { return null; }
}

function savePrefs(prefs: LocationPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* noop */ }
  // Also persist to server (fire-and-forget)
  fetch('/api/local-play/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: prefs.lat, lng: prefs.lng, zip: prefs.zip, city: prefs.city, radius_miles: prefs.radius_miles }),
  }).catch(() => {});
}

export default function LocalPlayPage() {
  const [prefs, setPrefs] = useState<LocationPrefs | null>(null);
  const [activeTab, setActiveTab] = useState<LocalPlayTab>('stores');
  const [changingLocation, setChangingLocation] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Load from localStorage first (instant), then check server
    const local = loadPrefs();
    if (local) setPrefs(local);

    fetch('/api/local-play/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((data: { prefs?: Record<string, unknown> | null } | null) => {
        if (data?.prefs?.default_lat) {
          const p = data.prefs;
          const serverPrefs: LocationPrefs = {
            lat: Number(p.default_lat),
            lng: Number(p.default_lng),
            city: String(p.default_city ?? ''),
            state: '',
            zip: String(p.default_zip ?? ''),
            radius_miles: Number(p.default_radius_miles ?? 50),
          };
          setPrefs(serverPrefs);
          savePrefs(serverPrefs);
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  function handleLocation(result: { lat: number; lng: number; city: string; state: string; zip: string }) {
    const newPrefs: LocationPrefs = {
      ...result,
      radius_miles: prefs?.radius_miles ?? 50,
    };
    setPrefs(newPrefs);
    savePrefs(newPrefs);
    setChangingLocation(false);
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (!prefs || changingLocation) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="px-4 py-6">
          <h1 className="text-xl font-bold text-zinc-100">Local Play</h1>
        </div>
        <LocationPrompt onLocation={handleLocation} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-zinc-100">Local Play</h1>
      </div>

      <LocationHeader
        city={prefs.city}
        state={prefs.state}
        radiusMiles={prefs.radius_miles}
        onChangeLocation={() => setChangingLocation(true)}
      />

      <SubTabStrip active={activeTab} onSelect={setActiveTab} />

      <div className="py-4">
        {activeTab === 'stores' && (
          <StoreList lat={prefs.lat} lng={prefs.lng} radius={prefs.radius_miles} />
        )}
        {activeTab === 'events' && (
          <EventList lat={prefs.lat} lng={prefs.lng} radius={prefs.radius_miles} />
        )}
        {activeTab === 'cards' && (
          <LocalCardSearch lat={prefs.lat} lng={prefs.lng} radius={prefs.radius_miles} />
        )}
      </div>
    </div>
  );
}
