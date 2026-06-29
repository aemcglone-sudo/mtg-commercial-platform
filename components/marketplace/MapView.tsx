'use client';

import { useEffect, useRef } from 'react';

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  popup?: string;
  isUser?: boolean;
}

interface Props {
  pins: MapPin[];
  className?: string;
  zoom?: number;
}

export default function MapView({ pins, className = 'h-64', zoom }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!ref.current || pins.length === 0) return;
    if (mapRef.current) return; // already initialised

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS then init
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;
      if (!ref.current) return;

      const center = pins[0];
      const autoZoom = zoom ?? (pins.length === 1 ? 14 : 11);
      const map = L.map(ref.current).setView([center.lat, center.lng], autoZoom);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      pins.forEach(pin => {
        const icon = L.divIcon({
          html: pin.isUser
            ? `<div style="width:12px;height:12px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`
            : `<div style="width:14px;height:14px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
        if (pin.popup) marker.bindPopup(pin.popup);
      });

      // Fit bounds if multiple shop pins
      const shopPins = pins.filter(p => !p.isUser);
      if (shopPins.length > 1) {
        map.fitBounds(shopPins.map((p: MapPin) => [p.lat, p.lng]), { padding: [30, 30] });
      }
    };
    document.head.appendChild(script);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapRef.current) { (mapRef.current as any).remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={`w-full rounded-xl overflow-hidden border border-zinc-800 ${className}`}
    />
  );
}
