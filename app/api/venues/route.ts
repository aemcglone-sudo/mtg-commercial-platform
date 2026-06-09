import { NextResponse } from 'next/server';

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
  distance?: number;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function queryOverpassAPI(latitude: number, longitude: number, radius: number) {
  const radiusMeters = radius * 1609.34; // Convert miles to meters
  const bbox = 0.1; // Roughly 11km at the equator

  // Overpass QL query for game stores, hobby shops, cafes, and entertainment venues
  const overpassQuery = `
    [bbox:${latitude - bbox},${longitude - bbox},${latitude + bbox},${longitude + bbox}];
    (
      node["shop"="hobby"];
      node["shop"="games"];
      node["shop"="toys"];
      node["amenity"="cafe"];
      node["amenity"="bar"];
      node["amenity"="restaurant"];
      node["leisure"="indoor_play"];
      node["name"~"game|magic|mtg|gaming|tabletop|board|hobby|cafe"i];
    );
    out center;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
    });

    if (!res.ok) return [];

    const data = await res.json();
    const venues: Venue[] = [];

    if (data.elements) {
      for (const element of data.elements) {
        const lat = element.lat || (element.center?.lat ?? 0);
        const lon = element.lon || (element.center?.lon ?? 0);

        if (!lat || !lon) continue;

        const distance = haversineDistance(latitude, longitude, lat, lon);
        if (distance > radius) continue;

        const venueName = element.tags?.name || 'Unknown Venue';
        const venueType = determineVenueType(venueName, element.tags);

        venues.push({
          id: `osm-${element.id}`,
          name: venueName,
          address: element.tags?.['addr:street'] || '',
          city: element.tags?.['addr:city'] || 'Unknown',
          state: element.tags?.['addr:state'] || 'USA',
          zipCode: element.tags?.['addr:postcode'] || '',
          latitude: lat,
          longitude: lon,
          type: venueType,
          formats: ['Commander', 'Standard', 'Modern', 'Casual'],
          website: element.tags?.website,
          phone: element.tags?.phone,
          distance,
        });
      }
    }

    return venues;
  } catch (err) {
    console.error('Overpass API error:', err);
    return [];
  }
}

function determineVenueType(name: string, tags: any): 'store' | 'tournament' | 'casual' {
  const nameLower = name.toLowerCase();
  const shopType = (tags?.shop || '').toLowerCase();
  const amenity = (tags?.amenity || '').toLowerCase();

  if (amenity === 'cafe' || nameLower.includes('cafe') || nameLower.includes('coffee')) {
    return 'casual';
  }
  if (shopType === 'games' || shopType === 'hobby' || nameLower.includes('game')) {
    return 'store';
  }
  return 'store';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get('latitude') || '0');
  const longitude = parseFloat(searchParams.get('longitude') || '0');
  const radiusMiles = parseInt(searchParams.get('radius') || '25') / 1609.34; // Convert meters to miles

  try {
    // Query OpenStreetMap data via Overpass API (FREE!)
    const venues = await queryOverpassAPI(latitude, longitude, radiusMiles);

    // Sort by distance
    venues.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    console.log(`Found ${venues.length} venues within ${radiusMiles} miles of ${latitude}, ${longitude} via OpenStreetMap`);

    return NextResponse.json({ venues });
  } catch (err) {
    console.error('Venue search error:', err);
    return NextResponse.json({ venues: [], error: 'Failed to fetch venues' }, { status: 500 });
  }
}
