'use client';

import { useEffect, useRef } from 'react';

interface Venue {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'store' | 'tournament' | 'casual';
}

interface VenuesMapProps {
  venues: Venue[];
  selectedVenueId?: string | null;
  onSelectVenue: (venueId: string) => void;
}

export default function VenuesMap({ venues, selectedVenueId, onSelectVenue }: VenuesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    // Dynamically load Leaflet
    if (typeof window === 'undefined') return;

    const loadMap = async () => {
      // Load Leaflet CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);

      // Load Leaflet JS
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.async = true;
      script.onload = () => {
        initMap();
      };
      document.body.appendChild(script);
    };

    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (window as any).L;

      // Create map centered on Pacific Northwest
      const map = L.map(mapRef.current).setView([46.2, -122.5], 7);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      updateMarkers(map, L);
    };

    const updateMarkers = (map: any, L: any) => {
      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      // Get venue type colors
      const getMarkerColor = (type: string): string => {
        switch (type) {
          case 'store':
            return '#3b82f6'; // blue
          case 'tournament':
            return '#ef4444'; // red
          case 'casual':
            return '#10b981'; // green
          default:
            return '#8b5cf6'; // purple
        }
      };

      // Add markers for each venue
      venues.forEach((venue) => {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              background-color: ${getMarkerColor(venue.type)};
              border-radius: 50%;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              font-size: 14px;
              cursor: pointer;
              ${selectedVenueId === venue.id ? 'box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.5), 0 2px 8px rgba(0,0,0,0.3);' : ''}
            ">
              ${venue.type === 'store' ? '🏪' : venue.type === 'tournament' ? '🏆' : '🎲'}
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        });

        const marker = L.marker([venue.latitude, venue.longitude], { icon }).addTo(map);

        marker.bindPopup(`
          <div style="font-weight: bold; color: #000;">${venue.name}</div>
        `);

        marker.on('click', () => {
          onSelectVenue(venue.id);
          map.setView([venue.latitude, venue.longitude], 10);
        });

        markersRef.current.push(marker);
      });

      // Fit bounds if there are venues
      if (venues.length > 0) {
        const bounds = L.latLngBounds(venues.map((v) => [v.latitude, v.longitude]));
        if (venues.length > 1) {
          map.fitBounds(bounds, { padding: [50, 50] });
        } else {
          map.setView([venues[0].latitude, venues[0].longitude], 12);
        }
      }
    };

    loadMap();

    return () => {
      // Cleanup: remove map instance on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [venues, selectedVenueId, onSelectVenue]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '24rem',
      }}
    />
  );
}
