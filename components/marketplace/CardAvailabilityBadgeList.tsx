'use client';

import { useState, useEffect } from 'react';
import CardAvailabilityBadge from './CardAvailabilityBadge';

interface CardInput {
  name: string;
  scryfallId?: string;
}

interface AvailabilityData {
  available: boolean;
  store_count: number;
  lowest_price_cents: number;
}

interface Props {
  cards: CardInput[];
  // scryfallId lookup map from parent (name → id)
  scryfallIdMap?: Record<string, string>;
}

export default function CardAvailabilityBadgeList({ cards, scryfallIdMap = {} }: Props) {
  const [availability, setAvailability] = useState<Record<string, AvailabilityData>>({});
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get location from collector prefs first, fallback to browser GPS
  useEffect(() => {
    fetch('/api/marketplace/preferences')
      .then(r => r.ok ? r.json() : null)
      .then((prefs: { lat: number | null; lng: number | null } | null) => {
        if (prefs?.lat && prefs?.lng) {
          setLocation({ lat: prefs.lat, lng: prefs.lng });
        } else {
          navigator.geolocation?.getCurrentPosition(
            pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {} // silently fail — badges just won't show
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!location) return;

    const ids = cards
      .map(c => c.scryfallId ?? scryfallIdMap[c.name.toLowerCase()])
      .filter(Boolean) as string[];

    if (ids.length === 0) return;

    setLoading(true);
    fetch(`/api/marketplace/availability?cards=${ids.join(',')}&lat=${location.lat}&lng=${location.lng}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, AvailabilityData> | null) => {
        if (data) setAvailability(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [location, cards.map(c => c.scryfallId ?? c.name).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="contents">
      {cards.map(c => {
        const id = c.scryfallId ?? scryfallIdMap[c.name.toLowerCase()];
        if (!id) return null;
        const data = availability[id];
        return (
          <CardAvailabilityBadge
            key={id}
            scryfallId={id}
            available={data?.available ?? false}
            storeCount={data?.store_count}
            lowestPriceCents={data?.lowest_price_cents}
            loading={loading && !data}
          />
        );
      })}
    </div>
  );
}
