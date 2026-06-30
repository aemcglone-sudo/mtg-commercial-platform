'use client';

import { useEffect, useRef, useState } from 'react';

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
  activePinLabel?: string;
}

function dotHtml(color: string, size: number, ring = false) {
  const ringStyle = ring ? `box-shadow:0 0 0 3px ${color}44,0 2px 6px rgba(0,0,0,0.5)` : 'box-shadow:0 1px 4px rgba(0,0,0,0.5)';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;${ringStyle}"></div>`;
}

export default function MapView({ pins, className = 'h-64', zoom, activePinLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const pinsRef = useRef(pins);
  const [expanded, setExpanded] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);

  pinsRef.current = pins;

  // Load Leaflet once
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (document.getElementById('leaflet-js')) {
      setLeafletReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map once Leaflet is ready
  useEffect(() => {
    if (!leafletReady || !containerRef.current || pins.length === 0) return;
    if (mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    const center = pins[0];
    const autoZoom = zoom ?? (pins.length === 1 ? 14 : 11);
    const map = L.map(containerRef.current).setView([center.lat, center.lng], autoZoom);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    pins.forEach(pin => {
      const icon = L.divIcon({
        html: pin.isUser ? dotHtml('#3b82f6', 12) : dotHtml('#10b981', 14),
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      if (pin.popup) marker.bindPopup(pin.popup);
      markersRef.current.set(pin.label, marker);
    });

    const shopPins = pins.filter(p => !p.isUser);
    if (shopPins.length > 1) {
      map.fitBounds(shopPins.map((p: MapPin) => [p.lat, p.lng]), { padding: [30, 30] });
    }

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapRef.current) { (mapRef.current as any).remove(); mapRef.current = null; markersRef.current.clear(); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  // Update marker icons when active pin changes
  useEffect(() => {
    if (!leafletReady) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    markersRef.current.forEach((marker, label) => {
      const pin = pinsRef.current.find(p => p.label === label);
      if (pin?.isUser) return;
      const isActive = label === activePinLabel;
      const icon = L.divIcon({
        html: isActive ? dotHtml('#f59e0b', 18, true) : dotHtml('#10b981', 14),
        className: '',
        iconSize: isActive ? [18, 18] : [14, 14],
        iconAnchor: isActive ? [9, 9] : [7, 7],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (marker as any).setIcon(icon);

      // Pan to active pin
      if (isActive && mapRef.current && pin) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).panTo([pin.lat, pin.lng], { animate: true });
      }
    });
  }, [activePinLabel, leafletReady]);

  // Invalidate size after expand/collapse transition
  useEffect(() => {
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapRef.current) (mapRef.current as any).invalidateSize();
    }, 310);
    return () => clearTimeout(timer);
  }, [expanded]);

  const heightClass = expanded ? 'h-[500px]' : className;

  return (
    <div className="relative z-0">
      <div
        ref={containerRef}
        className={`w-full rounded-xl overflow-hidden border border-zinc-800 transition-all duration-300 ${heightClass}`}
      />
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="absolute bottom-2 right-2 z-10 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded-lg backdrop-blur-sm transition-colors"
      >
        {expanded ? '⊖ Collapse' : '⊕ Expand'}
      </button>
    </div>
  );
}
