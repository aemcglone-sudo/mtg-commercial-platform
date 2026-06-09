/**
 * Magic Agent - Format Validator
 *
 * Validates deck legality for all Magic formats.
 * Detects banned/restricted cards.
 * Warns about format rotations.
 * Manages banned list snapshots.
 */

import { getCard, getCards } from '@/lib/scryfall';
import { getBannedList, updateBannedList, isCardBanned } from './db-queries';
import { getCachedData, setCachedData, JOB_THRESHOLDS } from './job-runner';
import type { ValidationResult, ValidationIssue, BanStatus, FormatInfo, RotationWarning } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Format legality in Scryfall
 */
type ScryfallLegality = 'legal' | 'banned' | 'restricted' | 'not_legal';

/**
 * Format metadata
 */
interface FormatMetadata {
  name: string;
  code: string;
  rotationDate: Date | null;
  cardPool: Set<string>;
  suggestedMaxCopies: Record<string, number>; // Card -> max copies allowed
}

// ============================================================================
// FORMAT CONFIGURATIONS
// ============================================================================

const FORMAT_INFO: Record<string, FormatMetadata> = {
  standard: {
    name: 'Standard',
    code: 'standard',
    rotationDate: new Date('2026-09-18'), // Approximate next rotation
    cardPool: new Set(), // Dynamic - loaded from Scryfall
    suggestedMaxCopies: {}, // Most cards: 4, basic lands: unlimited
  },
  pioneer: {
    name: 'Pioneer',
    code: 'pioneer',
    rotationDate: null, // No rotation
    cardPool: new Set(),
    suggestedMaxCopies: {},
  },
  modern: {
    name: 'Modern',
    code: 'modern',
    rotationDate: null,
    cardPool: new Set(),
    suggestedMaxCopies: {},
  },
  legacy: {
    name: 'Legacy',
    code: 'legacy',
    rotationDate: null,
    cardPool: new Set(),
    suggestedMaxCopies: {},
  },
  vintage: {
    name: 'Vintage',
    code: 'vintage',
    rotationDate: null,
    cardPool: new Set(),
    suggestedMaxCopies: { 'Black Lotus': 1, 'Ancestral Recall': 1 }, // Restricted cards
  },
  commander: {
    name: 'Commander',
    code: 'commander',
    rotationDate: null,
    cardPool: new Set(),
    suggestedMaxCopies: { __all__: 1 }, // Only commanders/basics can have > 1
  },
};

// ============================================================================
// BASIC LANDS (unlimited copies)
// ============================================================================

const BASIC_LANDS = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest',
  'Wastes', 'Healing Lands',
  'Shadowblood Ridge', // Test cards
]);

/**
 * Check if a card is a basic land (unlimited copies)
 */
function isBasicLand(cardName: string): boolean {
  return BASIC_LANDS.has(cardName);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validate a deck for a specific format
 *
 * @param deckCards - Map of card names to quantities
 * @param format - Format to validate for
 * @param deckId - Optional deck ID for reporting
 * @returns Validation result with any issues found
 */
export async function validateDeck(
  deckCards: Map<string, number>,
  format: 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander',
  deckId: string = ''
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // Get banned list for format
  const banList = await getBannedList(format);
  const bannedCards = banList?.bannedCards || [];
  const restrictedCards = banList?.restrictedCards || [];

  // Validate each card
  for (const [cardName, quantity] of deckCards) {
    // Check if banned
    if (bannedCards.includes(cardName)) {
      issues.push({
        type: 'banned',
        cardName,
        message: `${cardName} is banned in ${format}`,
        severity: 'error',
      });
      continue;
    }

    // Check if restricted (Vintage/Legacy)
    if (restrictedCards.includes(cardName)) {
      if (quantity > 1) {
        issues.push({
          type: 'restricted',
          cardName,
          message: `${cardName} is restricted to 1 copy in ${format}`,
          severity: 'error',
        });
      }
      continue;
    }

    // Check copy limit
    if (quantity > 4 && !isBasicLand(cardName)) {
      issues.push({
        type: 'too_many_copies',
        cardName,
        message: `${cardName}: ${quantity} copies (max 4)`,
        severity: format === 'commander' ? 'warning' : 'error',
      });
    }

    // Validate card exists in format
    const card = await getCard(cardName);
    if (!card) {
      issues.push({
        type: 'unknown_card',
        cardName,
        message: `${cardName} not found`,
        severity: 'warning',
      });
      continue;
    }

    // Check format legality
    const legality = card.legalities?.[format] as ScryfallLegality;
    if (legality === 'not_legal' || !legality) {
      issues.push({
        type: 'banned',
        cardName,
        message: `${cardName} is not legal in ${format}`,
        severity: 'error',
      });
    }
  }

  // Validate deck size
  let totalCards = 0;
  for (const quantity of deckCards.values()) {
    totalCards += quantity;
  }

  if (format === 'commander') {
    if (totalCards !== 100) {
      issues.push({
        type: 'banned', // Reuse type for deck size issue
        cardName: 'Deck',
        message: `Commander deck must be exactly 100 cards (${totalCards})`,
        severity: 'error',
      });
    }

    // Validate color identity (commander's color identity restricts others)
    // This would require getting the commander card first
  } else {
    if (totalCards < 60) {
      issues.push({
        type: 'banned',
        cardName: 'Deck',
        message: `${format} deck must be at least 60 cards (${totalCards})`,
        severity: 'error',
      });
    }
  }

  const isLegal = !issues.some(i => i.severity === 'error');

  return {
    deckId,
    format,
    isLegal,
    issues,
  };
}

/**
 * Check if a specific card is banned in a format
 *
 * @param cardName - Card name
 * @param format - Format to check
 * @returns Ban status
 */
export async function checkBannedStatus(
  cardName: string,
  format: string
): Promise<BanStatus> {
  const card = await getCard(cardName);

  // Check our database first
  const isBanned = await isCardBanned(cardName, format);

  let status: 'legal' | 'banned' | 'restricted' | 'suspended' | 'unknown' = 'unknown';
  if (isBanned) {
    status = 'banned';
  } else if (card?.legalities?.[format as keyof typeof card.legalities]) {
    const legality = card.legalities[format as keyof typeof card.legalities] as string;
    if (legality === 'legal') status = 'legal';
    else if (legality === 'restricted') status = 'restricted';
    else status = 'banned'; // not_legal treated as banned
  }

  return {
    cardName,
    format,
    status,
    announcedDate: null, // Would need historical data
  };
}

/**
 * Get format information
 *
 * @param format - Format name
 * @returns Format metadata
 */
export async function getFormatInfo(format: string): Promise<FormatInfo> {
  const meta = FORMAT_INFO[format.toLowerCase()];

  if (!meta) {
    return {
      format,
      legality: 'unsupported',
      cardPool: [],
      nextRotationDate: null,
      banList: [],
    };
  }

  const banList = await getBannedList(format);

  return {
    format: meta.name,
    legality: 'legal',
    cardPool: Array.from(meta.cardPool),
    nextRotationDate: meta.rotationDate,
    banList: (banList?.bannedCards || []).map(card => ({
      cardName: card,
      format,
      status: 'banned',
      announcedDate: null,
    })),
  };
}

/**
 * Detect cards that will rotate out of format
 *
 * @param userId - User ID (for filtering decks)
 * @param decks - Array of decks to check
 * @returns Rotation warnings
 */
export async function detectRotationImpact(
  userId: string,
  decks: Array<{ id: string; name: string; cards: Map<string, number> }>
): Promise<RotationWarning[]> {
  const warnings: RotationWarning[] = [];

  // Only Standard rotates currently
  const standardMeta = FORMAT_INFO.standard;
  if (!standardMeta.rotationDate || new Date() > standardMeta.rotationDate) {
    return warnings; // No upcoming rotation
  }

  for (const deck of decks) {
    const rotatingCards: string[] = [];

    for (const cardName of deck.cards.keys()) {
      const card = await getCard(cardName);
      if (!card) continue;

      // Check if card will rotate (not in new Standard)
      const legality = card.legalities?.standard as ScryfallLegality;
      if (legality !== 'legal') {
        rotatingCards.push(cardName);
      }
    }

    if (rotatingCards.length > 0) {
      const impactScore = (rotatingCards.length / deck.cards.size) * 100;

      warnings.push({
        deckId: deck.id,
        deckName: deck.name,
        rotatingCards,
        rotationDate: standardMeta.rotationDate,
        impactScore: Math.round(impactScore),
      });
    }
  }

  return warnings.sort((a, b) => b.impactScore - a.impactScore);
}

/**
 * Update banned list from Scryfall data
 *
 * Stores snapshot in database for historical tracking.
 *
 * @param format - Format to update
 * @param bannedCards - Array of banned card names
 * @param restrictedCards - Optional array of restricted cards
 */
export async function syncBannedList(
  format: string,
  bannedCards: string[],
  restrictedCards?: string[]
): Promise<void> {
  await updateBannedList(format, bannedCards, restrictedCards);

  // Clear cache so next query gets fresh data
  const cacheKey = `banned-list-${format}`;
  // Note: Would need to export cache clearing function from job-runner
}

/**
 * Get decks that contain banned cards
 *
 * @param format - Format to check
 * @param decks - Decks to check
 * @returns Decks with banned cards
 */
export async function findDecksWithBannedCards(
  format: string,
  decks: Array<{ id: string; name: string; cards: Map<string, number> }>
): Promise<Array<{ deckId: string; deckName: string; bannedCards: string[] }>> {
  const results: Array<{ deckId: string; deckName: string; bannedCards: string[] }> = [];
  const banList = await getBannedList(format);
  const bannedCardNames = banList?.bannedCards || [];

  for (const deck of decks) {
    const foundBanned = Array.from(deck.cards.keys()).filter(
      cardName => bannedCardNames.includes(cardName)
    );

    if (foundBanned.length > 0) {
      results.push({
        deckId: deck.id,
        deckName: deck.name,
        bannedCards: foundBanned,
      });
    }
  }

  return results;
}

// ============================================================================
// FORMAT RULES
// ============================================================================

/**
 * Get copy limit for a card in a format
 *
 * @param cardName - Card name
 * @param format - Format
 * @returns Maximum copies allowed (default 4)
 */
export function getCopyLimit(cardName: string, format: string): number {
  if (isBasicLand(cardName)) {
    return 999; // Unlimited
  }

  const meta = FORMAT_INFO[format.toLowerCase()];
  if (!meta) {
    return 4; // Default
  }

  // Check format-specific limits
  if (format === 'commander') {
    return 1; // Only 1 copy of each card (except commander and basics)
  }

  if (format === 'vintage') {
    if (meta.suggestedMaxCopies[cardName]) {
      return meta.suggestedMaxCopies[cardName];
    }
  }

  return 4; // Standard limit
}

/**
 * Get minimum deck size for a format
 *
 * @param format - Format
 * @returns Minimum deck size
 */
export function getMinDeckSize(format: string): number {
  return format === 'commander' ? 100 : 60;
}

/**
 * Check if format requires singleton (1 copy each)
 *
 * @param format - Format
 * @returns True if singleton format
 */
export function isSingletonFormat(format: string): boolean {
  return format === 'commander';
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Generate human-readable summary of validation issues
 *
 * @param result - Validation result
 * @returns Summary string
 */
export function summarizeValidation(result: ValidationResult): string {
  if (result.isLegal) {
    return `✓ ${result.format} deck is legal`;
  }

  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');

  let summary = `✗ ${result.format} deck has issues:\n`;

  if (errors.length > 0) {
    summary += `Errors (${errors.length}): ${errors.map(e => e.message).join(', ')}\n`;
  }

  if (warnings.length > 0) {
    summary += `Warnings (${warnings.length}): ${warnings.map(w => w.message).join(', ')}\n`;
  }

  return summary;
}

/**
 * Check if validation has any blocking errors
 *
 * @param result - Validation result
 * @returns True if deck cannot be played
 */
export function hasBlockingErrors(result: ValidationResult): boolean {
  return result.issues.some(i => i.severity === 'error');
}
