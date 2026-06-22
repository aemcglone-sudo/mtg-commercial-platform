/**
 * Magic Agent - Database Query Helpers
 *
 * Type-safe database functions for all agent tables.
 * Wraps the Prisma client with convenience methods for common operations.
 */

import { findOne, findMany, run } from '@/lib/db';
import {
  PriceHistory,
  DeckAnalysis,
  CardSynergy,
  UserPreferences,
  Suggestion,
  BannedListSnapshot,
  CommunityVenue,
  PricePoint,
} from './types';

// ============================================================================
// PRICE HISTORY QUERIES
// ============================================================================

export async function recordPriceSnapshot(
  cardName: string,
  source: 'scryfall' | 'tcgplayer' | 'cardmarket',
  priceUsd: number | null,
  priceFoilUsd: number | null
): Promise<void> {
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO price_history (id, "cardName", source, "priceUsd", "priceFoilUsd", "capturedAt")
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [id, cardName, source, priceUsd, priceFoilUsd]
  );
}

export async function getPriceHistory(
  cardName: string,
  days: number = 30,
  source?: string
): Promise<PricePoint[]> {
  const sourceFilter = source ? ` AND source = ?` : '';
  const args = source ? [cardName, days, source] : [cardName, days];

  const rows = await findMany<any>(
    `SELECT "cardName", "priceUsd" as price, "priceFoilUsd" as "foilPrice", "capturedAt" as date
     FROM price_history
     WHERE "cardName" = ? AND "capturedAt" > NOW() - (? * INTERVAL '1 day')${sourceFilter}
     ORDER BY "capturedAt" DESC`,
    args
  );

  return rows.map(r => ({
    cardName: r.cardName,
    date: new Date(r.date),
    price: r.price,
    foilPrice: r.foilPrice,
  }));
}

export async function getLatestPrice(
  cardName: string,
  source: string = 'scryfall'
): Promise<PricePoint | null> {
  const row = await findOne<any>(
    `SELECT "cardName", "priceUsd" as price, "priceFoilUsd" as "foilPrice", "capturedAt" as date
     FROM price_history
     WHERE "cardName" = ? AND source = ?
     ORDER BY "capturedAt" DESC
     LIMIT 1`,
    [cardName, source]
  );

  if (!row) return null;
  return {
    cardName: row.cardName,
    date: new Date(row.date),
    price: row.price,
    foilPrice: row.foilPrice,
  };
}

// ============================================================================
// DECK ANALYSIS QUERIES
// ============================================================================

export async function saveDeckAnalysis(
  userId: string,
  deckId: string,
  analysis: Partial<DeckAnalysis>
): Promise<void> {
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO deck_analysis (
      id, "userId", "deckId", "avgManaCost", "colorIdentity", "creatureCount",
      "spellCount", "landCount", "synergiesDetected", "metaScore", "tourneyAppearances",
      "successRate", "playedDate", notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      deckId,
      analysis.avgManaCost || null,
      analysis.colorIdentity ? JSON.stringify(analysis.colorIdentity) : null,
      analysis.creatureCount || null,
      analysis.spellCount || null,
      analysis.landCount || null,
      analysis.synergiesDetected ? JSON.stringify(analysis.synergiesDetected) : null,
      analysis.metaScore || null,
      analysis.tourneyAppearances || null,
      analysis.successRate || null,
      analysis.playedDate ? analysis.playedDate.toISOString() : null,
      analysis.notes || null,
    ]
  );
}

export async function getDeckAnalysis(deckId: string): Promise<DeckAnalysis | null> {
  const row = await findOne<any>(
    `SELECT * FROM deck_analysis WHERE "deckId" = ? ORDER BY "analyzedAt" DESC LIMIT 1`,
    [deckId]
  );

  if (!row) return null;
  return {
    ...row,
    colorIdentity: row.colorIdentity ? JSON.parse(row.colorIdentity) : null,
    synergiesDetected: row.synergiesDetected ? JSON.parse(row.synergiesDetected) : null,
    analyzedAt: new Date(row.analyzedAt),
    playedDate: row.playedDate ? new Date(row.playedDate) : null,
  };
}

export async function getUserDeckAnalyses(userId: string): Promise<DeckAnalysis[]> {
  const rows = await findMany<any>(
    `SELECT * FROM deck_analysis WHERE "userId" = ? ORDER BY "analyzedAt" DESC`,
    [userId]
  );

  return rows.map(row => ({
    ...row,
    colorIdentity: row.colorIdentity ? JSON.parse(row.colorIdentity) : null,
    synergiesDetected: row.synergiesDetected ? JSON.parse(row.synergiesDetected) : null,
    analyzedAt: new Date(row.analyzedAt),
    playedDate: row.playedDate ? new Date(row.playedDate) : null,
  }));
}

// ============================================================================
// CARD SYNERGY QUERIES
// ============================================================================

export async function getCardSynergies(cardName: string): Promise<CardSynergy[]> {
  return findMany<CardSynergy>(
    `SELECT * FROM card_synergies WHERE "cardName" = ? ORDER BY strength DESC`,
    [cardName]
  );
}

export async function addCardSynergy(
  cardName: string,
  synergyPartner: string,
  synergyType: 'combo' | 'synergy' | 'tribal' | 'color_fix',
  strength: number,
  note?: string
): Promise<void> {
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO card_synergies (id, "cardName", "synergyPartner", "synergyType", strength, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, cardName, synergyPartner, synergyType, strength, note || null]
  );
}

export async function findDeckSynergies(deckCards: string[]): Promise<CardSynergy[]> {
  if (deckCards.length === 0) return [];

  const placeholders = deckCards.map(() => '?').join(',');
  return findMany<CardSynergy>(
    `SELECT * FROM card_synergies
     WHERE "cardName" IN (${placeholders})
     AND "synergyPartner" IN (${placeholders})
     ORDER BY strength DESC`,
    [...deckCards, ...deckCards]
  );
}

// ============================================================================
// USER PREFERENCES QUERIES
// ============================================================================

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const row = await findOne<any>(
    `SELECT * FROM user_preferences WHERE "userId" = ?`,
    [userId]
  );

  if (!row) return null;
  return {
    ...row,
    favoriteFormats: row.favoriteFormats ? JSON.parse(row.favoriteFormats) : null,
    colorPreferences: row.colorPreferences ? JSON.parse(row.colorPreferences) : null,
    updatedAt: new Date(row.updatedAt),
  };
}

export async function updateUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<void> {
  const existing = await getUserPreferences(userId);

  if (!existing) {
    const id = crypto.randomUUID();
    await run(
      `INSERT INTO user_preferences (
        id, "userId", "favoriteFormats", "playStyle", "budgetRange", "collectorOrPlayer",
        "acceptanceRate", "averageDeckTurnaround", "colorPreferences", "updatedAt"
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        userId,
        preferences.favoriteFormats ? JSON.stringify(preferences.favoriteFormats) : null,
        preferences.playStyle || null,
        preferences.budgetRange || null,
        preferences.collectorOrPlayer || null,
        preferences.acceptanceRate || null,
        preferences.averageDeckTurnaround || null,
        preferences.colorPreferences ? JSON.stringify(preferences.colorPreferences) : null,
      ]
    );
  } else {
    const updates: string[] = [];
    const values: any[] = [];

    if (preferences.favoriteFormats !== undefined) {
      updates.push('"favoriteFormats" = ?');
      values.push(preferences.favoriteFormats ? JSON.stringify(preferences.favoriteFormats) : null);
    }
    if (preferences.playStyle !== undefined) {
      updates.push('"playStyle" = ?');
      values.push(preferences.playStyle);
    }
    if (preferences.budgetRange !== undefined) {
      updates.push('"budgetRange" = ?');
      values.push(preferences.budgetRange);
    }
    if (preferences.acceptanceRate !== undefined) {
      updates.push('"acceptanceRate" = ?');
      values.push(preferences.acceptanceRate);
    }
    if (preferences.colorPreferences !== undefined) {
      updates.push('"colorPreferences" = ?');
      values.push(preferences.colorPreferences ? JSON.stringify(preferences.colorPreferences) : null);
    }

    if (updates.length > 0) {
      updates.push('"updatedAt" = NOW()');
      values.push(userId);

      await run(
        `UPDATE user_preferences SET ${updates.join(', ')} WHERE "userId" = ?`,
        values
      );
    }
  }
}

// ============================================================================
// SUGGESTION QUERIES
// ============================================================================

export async function recordSuggestion(
  userId: string,
  suggestionType: Suggestion['suggestionType'],
  reason: string,
  deckId?: string,
  cardName?: string
): Promise<string> {
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO suggestions (id, "userId", "deckId", "cardName", "suggestionType", reason, "suggestedAt")
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [id, userId, deckId || null, cardName || null, suggestionType, reason]
  );
  return id;
}

export async function markSuggestionAdopted(
  suggestionId: string,
  feedback?: string
): Promise<void> {
  await run(
    `UPDATE suggestions
     SET adopted = TRUE, "adoptedAt" = NOW(), "userFeedback" = ?
     WHERE id = ?`,
    [feedback || null, suggestionId]
  );
}

export async function getUserSuggestions(
  userId: string,
  limit: number = 50
): Promise<Suggestion[]> {
  return findMany<Suggestion>(
    `SELECT * FROM suggestions WHERE "userId" = ? ORDER BY "suggestedAt" DESC LIMIT ?`,
    [userId, limit]
  );
}

export async function getSuggestionAdoptionRate(
  userId: string,
  suggestionType?: string
): Promise<number> {
  const typeFilter = suggestionType ? ` AND "suggestionType" = ?` : '';
  const args = suggestionType ? [userId, suggestionType] : [userId];

  const row = await findOne<any>(
    `SELECT
      COUNT(CASE WHEN adopted = TRUE THEN 1 END) as adopted,
      COUNT(*) as total
     FROM suggestions
     WHERE "userId" = ?${typeFilter}`,
    args
  );

  if (!row || row.total === 0) return 0;
  return row.adopted / row.total;
}

// ============================================================================
// BANNED LIST QUERIES
// ============================================================================

export async function getBannedList(
  format: string
): Promise<BannedListSnapshot | null> {
  const row = await findOne<any>(
    `SELECT * FROM banned_list_snapshots WHERE format = ? ORDER BY "snapshotDate" DESC LIMIT 1`,
    [format]
  );

  if (!row) return null;
  return {
    ...row,
    bannedCards: row.bannedCards ? JSON.parse(row.bannedCards) : null,
    restrictedCards: row.restrictedCards ? JSON.parse(row.restrictedCards) : null,
    snapshotDate: new Date(row.snapshotDate),
  };
}

export async function updateBannedList(
  format: string,
  bannedCards: string[],
  restrictedCards?: string[]
): Promise<void> {
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO banned_list_snapshots (id, format, "bannedCards", "restrictedCards", "snapshotDate")
     VALUES (?, ?, ?, ?, NOW())`,
    [
      id,
      format,
      JSON.stringify(bannedCards),
      restrictedCards ? JSON.stringify(restrictedCards) : null,
    ]
  );
}

export async function isCardBanned(
  cardName: string,
  format: string
): Promise<boolean> {
  const banList = await getBannedList(format);
  if (!banList || !banList.bannedCards) return false;
  return banList.bannedCards.includes(cardName);
}

// ============================================================================
// COMMUNITY VENUE QUERIES
// ============================================================================

export async function findNearbyVenues(
  latitude: number,
  longitude: number,
  radiusMiles: number = 25
): Promise<CommunityVenue[]> {
  const latDelta = radiusMiles / 69;
  const lonDelta = radiusMiles / (69 * Math.cos(latitude * Math.PI / 180));

  return findMany<any>(
    `SELECT * FROM community_venues
     WHERE latitude BETWEEN ? AND ?
     AND longitude BETWEEN ? AND ?
     ORDER BY "userRating" DESC NULLS LAST`,
    [
      latitude - latDelta,
      latitude + latDelta,
      longitude - lonDelta,
      longitude + lonDelta,
    ]
  );
}

export async function findVenuesInCity(
  city: string,
  state: string
): Promise<CommunityVenue[]> {
  return findMany<any>(
    `SELECT * FROM community_venues
     WHERE LOWER(city) = LOWER(?) AND LOWER(state) = LOWER(?)
     ORDER BY "userRating" DESC NULLS LAST`,
    [city, state]
  );
}

export async function findVenuesByFormat(
  format: string
): Promise<CommunityVenue[]> {
  return findMany<any>(
    `SELECT * FROM community_venues
     WHERE formats LIKE ?
     ORDER BY "userRating" DESC NULLS LAST`,
    ['%' + format + '%']
  );
}

export async function upsertVenue(venue: Partial<CommunityVenue>): Promise<string> {
  const id = venue.id || crypto.randomUUID();

  const existing = await findOne<any>(
    `SELECT id FROM community_venues WHERE id = ?`,
    [id]
  );

  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];

    if (venue.name) {
      updates.push('name = ?');
      values.push(venue.name);
    }
    if (venue.userRating !== undefined) {
      updates.push('"userRating" = ?');
      values.push(venue.userRating);
    }
    if (venue.reviewCount !== undefined) {
      updates.push('"reviewCount" = ?');
      values.push(venue.reviewCount);
    }
    if (venue.formats) {
      updates.push('formats = ?');
      values.push(JSON.stringify(venue.formats));
    }

    if (updates.length > 0) {
      values.push(id);
      await run(
        `UPDATE community_venues SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }
  } else {
    await run(
      `INSERT INTO community_venues (
        id, name, address, city, state, "zipCode", latitude, longitude,
        formats, "eventTypes", website, phone
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        venue.name || '',
        venue.address || null,
        venue.city || null,
        venue.state || null,
        venue.zipCode || null,
        venue.latitude || null,
        venue.longitude || null,
        venue.formats ? JSON.stringify(venue.formats) : null,
        venue.eventTypes ? JSON.stringify(venue.eventTypes) : null,
        venue.website || null,
        venue.phone || null,
      ]
    );
  }

  return id;
}
