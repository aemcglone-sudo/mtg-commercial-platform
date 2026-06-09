/**
 * Magic Agent - Community Locator
 *
 * Finds local MTG play communities and venues.
 * Manages community venue database.
 * Connects users to regional Magic communities.
 * Recommends stores based on format preferences.
 */

import { findNearbyVenues, findVenuesInCity, findVenuesByFormat, upsertVenue } from './db-queries';
import type { CommunityVenue, Venue, Event } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Venue search criteria
 */
export interface VenueSearchCriteria {
  latitude?: number;
  longitude?: number;
  radius?: number; // Miles
  city?: string;
  state?: string;
  format?: string;
  eventType?: 'tournament' | 'casual' | 'league';
}

/**
 * Venue with distance information
 */
export interface VenueWithDistance extends Venue {
  distance: number; // Miles from user
  matchScore: number; // 0-100, how well it matches criteria
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Major US Magic communities (seed data)
 */
const MAJOR_COMMUNITIES = [
  {
    name: 'SCG Worcester',
    city: 'Worcester',
    state: 'MA',
    formats: ['standard', 'modern', 'legacy', 'commander'],
    eventTypes: ['tournament', 'league'],
  },
  {
    name: 'StarCityGames Atlanta',
    city: 'Atlanta',
    state: 'GA',
    formats: ['standard', 'modern', 'commander'],
    eventTypes: ['tournament'],
  },
  {
    name: 'Channel Fireball',
    city: 'San Jose',
    state: 'CA',
    formats: ['standard', 'modern', 'legacy', 'commander'],
    eventTypes: ['tournament', 'casual'],
  },
];

/**
 * Distance calculation constants
 */
const EARTH_RADIUS_MILES = 3959;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Find venues near user location
 *
 * @param latitude - User latitude
 * @param longitude - User longitude
 * @param radiusMiles - Search radius (default 25)
 * @returns Venues sorted by distance
 */
export async function findNearbyVenuesForUser(
  latitude: number,
  longitude: number,
  radiusMiles: number = 25
): Promise<VenueWithDistance[]> {
  const venues = await findNearbyVenues(latitude, longitude, radiusMiles);

  return venues
    .map(venue => ({
      id: venue.id,
      name: venue.name,
      city: venue.city || 'Unknown',
      state: venue.state || 'Unknown',
      formats: venue.formats || [],
      eventTypes: venue.eventTypes || [],
      website: venue.website || null,
      distance: calculateDistance(
        latitude,
        longitude,
        venue.latitude || 0,
        venue.longitude || 0
      ),
      matchScore: 75 + (venue.userRating || 0) * 5, // Base score + rating boost
    } as VenueWithDistance))
    .filter(v => v.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Find venues by format preference
 *
 * @param formats - Formats to look for
 * @param latitude - Optional user location
 * @param longitude - Optional user location
 * @returns Venues supporting specified formats, optionally sorted by distance
 */
export async function findVenuesByFormats(
  formats: string[],
  latitude?: number,
  longitude?: number
): Promise<VenueWithDistance[]> {
  // Find venues that support all requested formats
  const venuesByFormat = await Promise.all(
    formats.map(format => findVenuesByFormat(format))
  );

  // Intersect: venues that appear in all format searches
  const venueCounts = new Map<string, number>();
  for (const venues of venuesByFormat) {
    const venueIds = new Set<string>();
    for (const venue of venues) {
      venueIds.add(venue.id);
      venueCounts.set(venue.id, (venueCounts.get(venue.id) || 0) + 1);
    }
  }

  // Get venues that support ALL formats
  const allVenues = venuesByFormat.flat();
  const matchingVenues = allVenues.filter(
    v => venueCounts.get(v.id) === formats.length
  );

  // Deduplicate by ID
  const uniqueVenues = Array.from(
    new Map(matchingVenues.map(v => [v.id, v])).values()
  );

  // Add distance if location provided
  if (latitude && longitude) {
    return uniqueVenues
      .map(v => ({
        id: v.id,
        name: v.name,
        city: v.city || 'Unknown',
        state: v.state || 'Unknown',
        formats: v.formats || [],
        eventTypes: v.eventTypes || [],
        website: v.website || null,
        distance: calculateDistance(latitude, longitude, v.latitude || 0, v.longitude || 0),
        matchScore: 80 + (v.userRating || 0) * 5,
      } as VenueWithDistance))
      .sort((a, b) => a.distance - b.distance);
  }

  return uniqueVenues.map(v => ({
    id: v.id,
    name: v.name,
    city: v.city || 'Unknown',
    state: v.state || 'Unknown',
    formats: v.formats || [],
    eventTypes: v.eventTypes || [],
    website: v.website || null,
    distance: Infinity,
    matchScore: 80 + (v.userRating || 0) * 5,
  } as VenueWithDistance));
}

/**
 * Search venues by multiple criteria
 *
 * @param criteria - Search criteria
 * @returns Matching venues ranked by relevance
 */
export async function searchVenues(
  criteria: VenueSearchCriteria
): Promise<VenueWithDistance[]> {
  let venues: CommunityVenue[] = [];

  // Choose search method based on criteria
  if (criteria.latitude && criteria.longitude) {
    venues = await findNearbyVenues(
      criteria.latitude,
      criteria.longitude,
      criteria.radius || 25
    );
  } else if (criteria.city && criteria.state) {
    venues = await findVenuesInCity(criteria.city, criteria.state);
  } else if (criteria.format) {
    venues = await findVenuesByFormat(criteria.format);
  } else {
    return []; // No search criteria
  }

  // Filter by additional criteria
  let filtered = venues;

  if (criteria.eventType) {
    filtered = filtered.filter(
      v => v.eventTypes?.includes(criteria.eventType as string)
    );
  }

  if (criteria.format) {
    filtered = filtered.filter(v => v.formats?.includes(criteria.format!));
  }

  // Score and sort
  const scored = filtered.map(v => ({
    id: v.id,
    name: v.name,
    city: v.city || 'Unknown',
    state: v.state || 'Unknown',
    formats: v.formats || [],
    eventTypes: v.eventTypes || [],
    website: v.website || null,
    distance: criteria.latitude && criteria.longitude
      ? calculateDistance(
          criteria.latitude,
          criteria.longitude,
          v.latitude || 0,
          v.longitude || 0
        )
      : 0,
    matchScore: calculateVenueMatchScore(v, criteria),
  } as VenueWithDistance));

  return scored
    .sort((a, b) => b.matchScore - a.matchScore || a.distance - b.distance)
    .slice(0, 10);
}

/**
 * Get venue details with additional info
 *
 * @param venueId - Venue ID
 * @returns Venue with reviews and event info
 */
export async function getVenueDetails(venueId: string): Promise<{
  venue: CommunityVenue;
  upcomingEvents: Event[];
  communitySize: string; // "small", "medium", "large", "unknown"
  communityVibe: string; // Based on reviews
}> {
  // This would fetch from database
  // For now, return stub

  return {
    venue: {
      id: venueId,
      name: 'Unknown Venue',
      address: null,
      city: '',
      state: '',
      zipCode: null,
      latitude: null,
      longitude: null,
      formats: [],
      eventTypes: [],
      website: null,
      phone: null,
      verifiedAt: null,
      userRating: null,
      reviewCount: null,
      createdAt: new Date(),
    } as CommunityVenue,
    upcomingEvents: [],
    communitySize: 'unknown',
    communityVibe: 'No reviews yet',
  };
}

/**
 * Add or update a venue (user submission)
 *
 * @param venue - Venue data to add/update
 * @returns Venue ID
 */
export async function submitVenue(
  venue: Partial<CommunityVenue>
): Promise<string> {
  return upsertVenue(venue);
}

/**
 * Rate or review a venue
 *
 * @param venueId - Venue ID
 * @param rating - Rating 0-5 stars
 * @param review - Optional review text
 */
export async function rateVenue(
  venueId: string,
  rating: number,
  review?: string
): Promise<void> {
  // Would update venue in database with new rating
  // Aggregate with existing reviews
  console.log(`Rated venue ${venueId}: ${rating} stars`);
}

/**
 * Get trending communities (fast-growing scenes)
 *
 * @returns Communities with most activity
 */
export async function getTrendingCommunities(): Promise<
  Array<{
    venue: CommunityVenue;
    trend: 'rising' | 'stable' | 'declining';
    activityLevel: 'low' | 'medium' | 'high';
  }>
> {
  // Would analyze event frequency and user activity
  // For now, return seed communities

  return MAJOR_COMMUNITIES.map(community => ({
    venue: { id: '', createdAt: new Date(), ...community } as any,
    trend: 'stable',
    activityLevel: 'high',
  }));
}

/**
 * Find communities based on user's format preferences
 *
 * @param formats - Preferred formats
 * @param location - Optional location preference
 * @returns Venues matching preferences
 */
export async function recommendVenuesByPreference(
  formats: string[],
  location?: { latitude: number; longitude: number }
): Promise<VenueWithDistance[]> {
  return findVenuesByFormats(formats, location?.latitude, location?.longitude);
}

/**
 * Get community stats for a venue
 *
 * @param venueId - Venue ID
 * @returns Community statistics
 */
export async function getCommunityStats(venueId: string): Promise<{
  monthlyEvents: number;
  averageAttendance: number;
  popularFormats: string[];
  avgPlayerRating: number;
  trendingDecks: string[];
}> {
  // Would calculate from events and reviews
  return {
    monthlyEvents: 0,
    averageAttendance: 0,
    popularFormats: [],
    avgPlayerRating: 0,
    trendingDecks: [],
  };
}

/**
 * Find players with similar deck interests near user
 *
 * @param userLatitude - User location
 * @param userLongitude - User location
 * @param formats - User's formats
 * @returns Nearby players with similar interests
 */
export async function findSimilarPlayersNearby(
  userLatitude: number,
  userLongitude: number,
  formats: string[]
): Promise<
  Array<{
    name: string;
    distance: number;
    mutualFormats: string[];
    deck: string;
  }>
> {
  // Would query user/player database with location
  // For now, return empty
  return [];
}

/**
 * Export/import venue data
 *
 * Enables community to share venue information
 */
export async function exportVenueDirectory(): Promise<string> {
  // Would export all venues as JSON
  return JSON.stringify([]);
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two points (haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate venue match score based on criteria
 */
function calculateVenueMatchScore(
  venue: CommunityVenue,
  criteria: VenueSearchCriteria
): number {
  let score = 50;

  // Format match
  if (criteria.format && venue.formats?.includes(criteria.format)) {
    score += 25;
  }

  // Event type match
  if (criteria.eventType && venue.eventTypes?.includes(criteria.eventType)) {
    score += 15;
  }

  // Rating boost
  if (venue.userRating) {
    score += venue.userRating * 5;
  }

  // Verification boost
  if (venue.verifiedAt) {
    score += 10;
  }

  return Math.min(100, score);
}
