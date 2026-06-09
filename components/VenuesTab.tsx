'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import LocationPermission from './LocationPermission';

// Dynamically import map component to avoid SSR issues
const VenuesMap = dynamic(() => import('./VenuesMap'), { ssr: false });

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  type: 'store' | 'tournament' | 'casual';
  formats: string[];
  website?: string;
  phone?: string;
  distance?: number; // in miles from user
}

// Fallback sample venues for offline/API failure
const FALLBACK_VENUES: Venue[] = [
  {
    id: 'fallback-1',
    name: 'Local Game Store',
    address: '123 Game Street',
    city: 'Your City',
    state: 'Your State',
    zipCode: '00000',
    latitude: 0,
    longitude: 0,
    type: 'store',
    formats: ['Standard', 'Modern', 'Commander'],
  },
];

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'store':
      return 'bg-blue-900 text-blue-200';
    case 'tournament':
      return 'bg-red-900 text-red-200';
    case 'casual':
      return 'bg-green-900 text-green-200';
    default:
      return 'bg-gray-900 text-gray-200';
  }
};

const getTypeIcon = (type: string): string => {
  switch (type) {
    case 'store':
      return '🏪';
    case 'tournament':
      return '🏆';
    case 'casual':
      return '🎲';
    default:
      return '📍';
  }
};

interface UserLocation {
  latitude: number;
  longitude: number;
}

// Calculate distance between two coordinates in miles
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function VenuesTab() {
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'store' | 'tournament' | 'casual'>('all');
  const [filterFormat, setFilterFormat] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const [manualLocation, setManualLocation] = useState('');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    website: '',
    venueType: 'store' as 'store' | 'tournament' | 'casual',
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch venues from API when location changes
  const fetchVenues = async (lat: number, lon: number) => {
    setLoadingVenues(true);
    try {
      const res = await fetch(`/api/venues?latitude=${lat}&longitude=${lon}&radius=25000`);
      if (res.ok) {
        const data = await res.json();
        setVenues(data.venues || FALLBACK_VENUES);
      } else {
        setVenues(FALLBACK_VENUES);
      }
    } catch (err) {
      console.error('Error fetching venues:', err);
      setVenues(FALLBACK_VENUES);
    } finally {
      setLoadingVenues(false);
    }
  };

  // Submit a new venue
  const handleSubmitVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userLocation) {
      alert('Please set your location first');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/venues/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...submitForm,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setShowSubmitForm(false);
        // Refresh venues
        fetchVenues(userLocation.latitude, userLocation.longitude);
        // Reset form
        setSubmitForm({
          name: '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          phone: '',
          website: '',
          venueType: 'store',
        });
      } else {
        const error = await res.json();
        alert('Error: ' + (error.error || 'Failed to submit venue'));
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('Error submitting venue');
    } finally {
      setSubmitting(false);
    }
  };

  // Load saved location on mount
  useEffect(() => {
    const loadLocation = async () => {
      // First, try to load saved location from localStorage
      const savedLocationData = localStorage.getItem('userVenueLocation');
      if (savedLocationData) {
        try {
          const location = JSON.parse(savedLocationData);
          setUserLocation(location);
          fetchVenues(location.latitude, location.longitude);
          setLocationError(null);
          return;
        } catch (err) {
          console.error('Error loading saved location:', err);
        }
      }

      // Try to load from database (Settings page location)
      try {
        const res = await fetch('/api/user/location');
        if (res.ok) {
          const data = await res.json();
          if (data?.latitude && data?.longitude) {
            const location = {
              latitude: data.latitude,
              longitude: data.longitude,
            };
            setUserLocation(location);
            fetchVenues(location.latitude, location.longitude);
            localStorage.setItem('userVenueLocation', JSON.stringify(location));
            setLocationError(null);
            return;
          }
        }
      } catch (err) {
        console.error('Error loading location from database:', err);
      }

      // Try free IP geolocation API (often more accurate than browser geolocation)
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          if (data.latitude && data.longitude) {
            const location = {
              latitude: data.latitude,
              longitude: data.longitude,
            };
            setUserLocation(location);
            fetchVenues(location.latitude, location.longitude);
            localStorage.setItem('userVenueLocation', JSON.stringify(location));
            setLocationError(null);
            return;
          }
        }
      } catch (err) {
        console.error('Error with IP geolocation:', err);
      }

      // No location found - ask user to enter one
      setLocationError('Enter your location above to find nearby venues.');
      setVenues(FALLBACK_VENUES);
    };

    loadLocation();
  }, []);

  // Add distances to venues
  const venuesWithDistance = venues.map((venue) => ({
    ...venue,
    distance: userLocation
      ? calculateDistance(userLocation.latitude, userLocation.longitude, venue.latitude, venue.longitude)
      : undefined,
  }));

  let filteredVenues = venuesWithDistance.filter((venue) => {
    if (filterType !== 'all' && venue.type !== filterType) return false;
    if (filterFormat && !venue.formats.includes(filterFormat)) return false;
    return true;
  });

  // Sort venues
  if (sortBy === 'distance' && userLocation) {
    filteredVenues = [...filteredVenues].sort((a, b) => {
      const distA = a.distance ?? Infinity;
      const distB = b.distance ?? Infinity;
      return distA - distB;
    });
  } else {
    filteredVenues = [...filteredVenues].sort((a, b) => a.name.localeCompare(b.name));
  }

  const allFormats = Array.from(
    new Set(venues.flatMap((v) => v.formats))
  ).sort();

  const selectedVenueData = selectedVenue
    ? venuesWithDistance.find((v) => v.id === selectedVenue)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">📍 Where to Play & Buy Magic</h2>
          <p className="text-zinc-400">Game stores, tournaments, and play groups near you (powered by OpenStreetMap - free data!)</p>
        </div>

        {/* Location input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g., Atlanta, GA or Seattle, WA"
            value={manualLocation}
            onChange={(e) => setManualLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualLocation.trim()) {
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualLocation)}`)
                  .then(r => r.json())
                  .then(results => {
                    if (results && results.length > 0) {
                      const location = {
                        latitude: parseFloat(results[0].lat),
                        longitude: parseFloat(results[0].lon),
                      };
                      setUserLocation(location);
                      fetchVenues(location.latitude, location.longitude);
                      localStorage.setItem('userVenueLocation', JSON.stringify(location));
                      setLocationError(null);
                    } else {
                      setLocationError('City not found. Try another location.');
                    }
                  })
                  .catch(() => setLocationError('Error finding location.'));
              }
            }}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none flex-1"
          />
          <button
            type="button"
            onClick={() => {
              if (manualLocation.trim()) {
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualLocation)}`)
                  .then(r => r.json())
                  .then(results => {
                    if (results && results.length > 0) {
                      const location = {
                        latitude: parseFloat(results[0].lat),
                        longitude: parseFloat(results[0].lon),
                      };
                      setUserLocation(location);
                      fetchVenues(location.latitude, location.longitude);
                      localStorage.setItem('userVenueLocation', JSON.stringify(location));
                      setLocationError(null);
                    } else {
                      setLocationError('City not found. Try another location.');
                    }
                  })
                  .catch(() => setLocationError('Error finding location.'));
              }
            }}
            className="px-4 py-2 bg-amber-400 text-black rounded-lg font-medium text-sm hover:bg-amber-300 transition-colors disabled:opacity-50"
            disabled={loadingVenues}
          >
            {loadingVenues ? 'Searching...' : 'Search'}
          </button>
        </div>

        {locationError && (
          <p className="text-amber-600 text-sm">⚠️ {locationError}</p>
        )}
        {userLocation && (
          <p className="text-green-600 text-sm">✓ Using your location to find nearby venues</p>
        )}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-700 overflow-hidden h-96 bg-zinc-900">
            <VenuesMap venues={filteredVenues} selectedVenueId={selectedVenue} onSelectVenue={setSelectedVenue} />
          </div>
        </div>

        {/* Filters and details */}
        <div className="space-y-4">
          {/* Venue type filter */}
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Venue Type</label>
            <div className="space-y-2">
              {(['all', 'store', 'tournament', 'casual'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`w-full px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                    filterType === type
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {type === 'all' ? '🌐 All Venues' : `${getTypeIcon(type)} ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                </button>
              ))}
            </div>
          </div>

          {/* Format filter */}
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Format</label>
            <select
              value={filterFormat ?? ''}
              onChange={(e) => setFilterFormat(e.target.value || null)}
              title="Filter venues by format"
              className="w-full px-3 py-2 bg-zinc-800 text-zinc-200 rounded-lg text-sm border border-zinc-700 focus:border-amber-500 focus:outline-none"
            >
              <option value="">All Formats</option>
              {allFormats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>

          {/* Sort by */}
          {userLocation && (
            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">Sort By</label>
              <div className="space-y-2">
                {(['distance', 'name'] as const).map((sortOption) => (
                  <button
                    key={sortOption}
                    type="button"
                    onClick={() => setSortBy(sortOption)}
                    className={`w-full px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                      sortBy === sortOption
                        ? 'bg-amber-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {sortOption === 'distance' ? '📍 Nearest First' : '🔤 A-Z'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected venue details or list */}
          {selectedVenueData ? (
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h3 className="font-bold text-lg mb-3">{selectedVenueData.name}</h3>

              <div className="space-y-2 text-sm">
                <div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getTypeColor(selectedVenueData.type)}`}>
                    {getTypeIcon(selectedVenueData.type)} {selectedVenueData.type.toUpperCase()}
                  </span>
                </div>

                {selectedVenueData.distance !== undefined && (
                  <div>
                    <p className="text-zinc-400 text-xs">DISTANCE</p>
                    <p className="text-zinc-100 font-semibold">{selectedVenueData.distance.toFixed(1)} miles away</p>
                  </div>
                )}

                <div>
                  <p className="text-zinc-400 text-xs">ADDRESS</p>
                  <p className="text-zinc-100">
                    {selectedVenueData.address}
                    <br />
                    {selectedVenueData.city}, {selectedVenueData.state} {selectedVenueData.zipCode}
                  </p>
                </div>

                {selectedVenueData.phone && (
                  <div>
                    <p className="text-zinc-400 text-xs">PHONE</p>
                    <a href={`tel:${selectedVenueData.phone}`} className="text-amber-400 hover:text-amber-300">
                      {selectedVenueData.phone}
                    </a>
                  </div>
                )}

                {selectedVenueData.website && (
                  <div>
                    <p className="text-zinc-400 text-xs">WEBSITE</p>
                    <a
                      href={`https://${selectedVenueData.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 break-all"
                    >
                      {selectedVenueData.website}
                    </a>
                  </div>
                )}

                <div>
                  <p className="text-zinc-400 text-xs">FORMATS</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedVenueData.formats.map((format) => (
                      <span key={format} className="px-2 py-1 bg-zinc-700 text-zinc-200 text-xs rounded">
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVenue(null)}
                className="w-full mt-4 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors"
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">
                Venues ({filteredVenues.length})
              </label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredVenues.length === 0 ? (
                  <p className="text-zinc-500 text-sm py-4">No venues match your filters.</p>
                ) : (
                  filteredVenues.map((venue) => (
                    <button
                      key={venue.id}
                      type="button"
                      onClick={() => setSelectedVenue(venue.id)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                      <div className="font-semibold text-sm">{venue.name}</div>
                      <div className="text-xs text-zinc-400">
                        {venue.city}, {venue.state}
                        {venue.distance !== undefined && ` • ${venue.distance.toFixed(1)} mi`}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{getTypeIcon(venue.type)} {venue.type}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
