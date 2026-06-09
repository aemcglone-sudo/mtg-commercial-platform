/**
 * Magic Agent - Chat Integration
 *
 * Bridges agent modules with Shahrazad chat interface.
 * Runs agents async, formats results for expandable UI cards.
 */

import {
  getMetaSnapshot,
  scoreDeckAgainstMeta,
  detectMetaShift,
  getMetaKeyCards,
  getCardPrices,
  detectPriceAnomaly,
  getCardPrice,
  validateDeck,
  checkBannedStatus,
  optimizeDeck,
  getCardRecommendations,
  findSynergies,
  getCardSynergies,
  getUserProfile,
  findNearbyVenuesForUser,
  searchVenues,
  calculateDeckPrice,
  identifyPremiumCards,
  type MetaData,
  type OptimizationReport,
  type DetailedRecommendation,
  type VenueSearchCriteria,
} from './index';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentCard {
  id: string;
  title: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
  items: AgentCardItem[];
}

export interface AgentCardItem {
  text: string;
  badge?: string; // "↑8%", "⚠️ Banned", "New", etc.
  actionButton?: string; // "Add to deck", "Buy now", etc.
  actionType?: 'add-card' | 'buy' | 'view-venue' | 'optimize';
  actionData?: Record<string, any>;
}

export interface ChatAnalysisRequest {
  userId?: string;
  deckId?: string;
  deckName?: string;
  deckCards?: Map<string, number>;
  format?: string;
  userCollection?: Map<string, number>;
  userLocation?: { latitude: number; longitude: number };
  userBudget?: number;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Run all applicable agents based on context and return suggestion cards
 * Runs async (non-blocking) and returns results as they complete
 */
export async function analyzeForChat(
  request: ChatAnalysisRequest
): Promise<AgentCard[]> {
  const cards: AgentCard[] = [];

  // Collect results from agents in parallel
  const [metaCard, priceCard, optimizationCard, budgetCard, communityCard] = await Promise.allSettled([
    buildMetaCard(request),
    buildPriceCard(request),
    buildOptimizationCard(request),
    buildBudgetCard(request),
    buildCommunityCard(request),
  ]);

  // Add successful results
  if (metaCard.status === 'fulfilled' && metaCard.value) cards.push(metaCard.value);
  if (priceCard.status === 'fulfilled' && priceCard.value) cards.push(priceCard.value);
  if (optimizationCard.status === 'fulfilled' && optimizationCard.value) cards.push(optimizationCard.value);
  if (budgetCard.status === 'fulfilled' && budgetCard.value) cards.push(budgetCard.value);
  if (communityCard.status === 'fulfilled' && communityCard.value) cards.push(communityCard.value);

  // Sort by priority (high first) then by index
  return cards.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ============================================================================
// INDIVIDUAL CARD BUILDERS
// ============================================================================

/**
 * Meta Analysis Card: Current format trends, deck alignment
 */
async function buildMetaCard(req: ChatAnalysisRequest): Promise<AgentCard | null> {
  if (!req.format || !req.deckCards || req.deckCards.size === 0) return null;

  // Only support formats with meta data available
  const supportedFormats = ['standard', 'pioneer', 'modern', 'commander'];
  if (!supportedFormats.includes(req.format)) return null;

  try {
    const format = req.format as 'standard' | 'pioneer' | 'modern' | 'commander';
    const meta = await getMetaSnapshot(format);
    if (!meta) return null;

    const deckScore = await scoreDeckAgainstMeta(req.deckCards, format);

    const keyCards = await getMetaKeyCards(format, 10);

    const deckHasKeyCards = keyCards.filter((card: any) =>
      req.deckCards?.has(card.name)
    ).length;

    const items: AgentCardItem[] = [
      {
        text: `${req.format} meta (${meta.archetypes?.length || 0} archetypes)`,
        badge: `${deckScore.metaScore.toFixed(0)}/100`,
      },
      {
        text: `Your deck matches ${deckHasKeyCards}/${keyCards.length} top meta cards`,
        badge: deckHasKeyCards >= 7 ? '✅ Strong' : '⚠️ Weak',
      },
    ];

    // Check for bans
    if (req.deckCards.size > 0) {
      const cardNames = Array.from(req.deckCards.keys()).slice(0, 5);
      for (const cardName of cardNames) {
        const banStatus = await checkBannedStatus(cardName, req.format);
        if (banStatus.status === 'banned' || banStatus.status === 'restricted') {
          items.push({
            text: `⚠️ ${cardName} is ${banStatus.status} in ${req.format}`,
            badge: 'ILLEGAL',
          });
        }
      }
    }

    return {
      id: 'meta-analysis',
      title: 'Meta Analysis',
      icon: '📊',
      priority: 'high',
      items,
    };
  } catch (error) {
    console.error('Meta card error:', error);
    return null;
  }
}

/**
 * Price Card: Price changes, anomalies, buy/sell signals
 */
async function buildPriceCard(req: ChatAnalysisRequest): Promise<AgentCard | null> {
  if (!req.userCollection || req.userCollection.size === 0) return null;

  try {
    const cardNames = Array.from(req.userCollection.keys()).slice(0, 20); // Sample first 20
    const prices = await getCardPrices(cardNames);

    const items: AgentCardItem[] = [];
    const anomalies: { card: string; direction: string; magnitude: number }[] = [];

    for (const [cardName, price] of prices) {
      const anomaly = await detectPriceAnomaly(cardName);
      if (anomaly) {
        anomalies.push({ card: cardName, direction: anomaly.direction, magnitude: anomaly.magnitude });
      }
    }

    if (anomalies.length === 0) {
      return null; // No price activity
    }

    anomalies.slice(0, 3).forEach(anom => {
      const badge = anom.direction === 'up'
        ? `↑${(anom.magnitude * 100).toFixed(0)}%`
        : `↓${(anom.magnitude * 100).toFixed(0)}%`;
      items.push({
        text: anom.card,
        badge,
        actionButton: anom.direction === 'up' ? 'Sell?' : 'Buy?',
      });
    });

    return {
      id: 'price-opportunities',
      title: 'Price Movements',
      icon: '💎',
      priority: 'medium',
      items,
    };
  } catch (error) {
    console.error('Price card error:', error);
    return null;
  }
}

/**
 * Optimization Card: Mana curve, key cards, swaps
 */
async function buildOptimizationCard(req: ChatAnalysisRequest): Promise<AgentCard | null> {
  if (!req.deckCards || req.deckCards.size === 0) return null;

  try {
    const format = (req.format || 'commander') as 'standard' | 'pioneer' | 'modern' | 'commander' | 'legacy' | 'vintage';
    const report = await optimizeDeck(req.deckCards, format, req.deckName);
    if (!report || report.currentScore === 0) return null;

    const items: AgentCardItem[] = [
      {
        text: `Mana curve health: ${report.manaCurve?.healthScore?.toFixed(0) || '?'}/100`,
        badge: report.improvementPotential > 15 ? '🔧 Optimize' : '✅ Good',
      },
    ];

    // Add key issues
    if (report.manaCurve?.issues && report.manaCurve.issues.length > 0) {
      report.manaCurve.issues.slice(0, 2).forEach((issue: string) => {
        items.push({
          text: issue,
          badge: '⚠️',
        });
      });
    }

    // Add top improvement
    if (report.recommendations && report.recommendations.length > 0) {
      const top = report.recommendations[0];
      items.push({
        text: `Consider: ${top.cardName}`,
        badge: `${top.score?.toFixed(0) || '?'} pts`,
        actionButton: 'Add to deck',
        actionType: 'add-card',
        actionData: { card: top.cardName },
      });
    }

    return {
      id: 'deck-optimization',
      title: 'Optimization Suggestions',
      icon: '🎯',
      priority: 'high',
      items,
    };
  } catch (error) {
    console.error('Optimization card error:', error);
    return null;
  }
}

/**
 * Budget Card: Deck cost, expensive cards, alternatives
 */
async function buildBudgetCard(req: ChatAnalysisRequest): Promise<AgentCard | null> {
  if (!req.deckCards || req.deckCards.size === 0) return null;

  try {
    const pricing = await calculateDeckPrice(req.deckCards);
    if (!pricing || pricing.totalCost === 0) return null;

    const items: AgentCardItem[] = [
      {
        text: `Deck cost: $${pricing.totalCost.toFixed(2)}`,
        badge: pricing.totalCost > 300 ? '💰 Premium' : pricing.totalCost > 150 ? '🔷 Moderate' : '💵 Budget',
      },
    ];

    // Show most expensive cards
    if (pricing.expensiveCards && pricing.expensiveCards.length > 0) {
      pricing.expensiveCards.slice(0, 2).forEach(card => {
        const total = card.price * card.quantity;
        items.push({
          text: `${card.cardName} (${card.quantity}x) — $${total.toFixed(2)}`,
          badge: `$${card.price.toFixed(0)} ea`,
          actionButton: 'Find cheaper',
          actionType: 'buy',
        });
      });
    }

    // If user specified budget, show gap
    if (req.userBudget && pricing.totalCost > req.userBudget) {
      const gap = pricing.totalCost - req.userBudget;
      items.push({
        text: `Budget target: $${req.userBudget}`,
        badge: `Gap: $${gap.toFixed(2)}`,
      });
    }

    return {
      id: 'budget-analysis',
      title: 'Budget Breakdown',
      icon: '💰',
      priority: 'medium',
      items,
    };
  } catch (error) {
    console.error('Budget card error:', error);
    return null;
  }
}

/**
 * Community Card: Nearby venues, local meta, events
 */
async function buildCommunityCard(req: ChatAnalysisRequest): Promise<AgentCard | null> {
  if (!req.userLocation || !req.format) return null;

  try {
    const venues = await findNearbyVenuesForUser(
      req.userLocation.latitude,
      req.userLocation.longitude,
      25 // 25 mile radius
    );

    if (!venues || venues.length === 0) return null;

    const items: AgentCardItem[] = [];

    venues.slice(0, 3).forEach(venue => {
      const formatsMatch = venue.formats.includes(req.format || '');
      items.push({
        text: `${venue.name} — ${venue.distance.toFixed(1)} miles`,
        badge: formatsMatch ? `✅ ${req.format}` : '📍',
        actionButton: 'View details',
        actionType: 'view-venue',
        actionData: { venueId: venue.id },
      });
    });

    return {
      id: 'community-venues',
      title: 'Local Communities',
      icon: '🌍',
      priority: 'low',
      items,
    };
  } catch (error) {
    console.error('Community card error:', error);
    return null;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format agent cards for streaming JSON
 */
export function formatCardsForStream(cards: AgentCard[]): string {
  return JSON.stringify({
    type: 'agent-cards',
    cards,
  });
}

/**
 * Extract deck info from chat context
 * Tries to infer deck details from conversation
 */
export function extractDeckFromContext(
  messages: Array<{ role: string; content: string }>,
  allCards: Array<{ name: string; qty: number; value?: number }>
): ChatAnalysisRequest {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

  // Detect format mentions
  const formats = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander'];
  let detectedFormat = undefined;
  for (const format of formats) {
    if (lastMessage.includes(format)) {
      detectedFormat = format;
      break;
    }
  }

  // Try to extract budget mention
  let budget = undefined;
  const budgetMatch = lastMessage.match(/\$(\d+)/);
  if (budgetMatch) {
    budget = parseInt(budgetMatch[1]);
  }

  // For now, use full collection as deck (could be smarter)
  const deckCards = new Map(allCards.map(c => [c.name, c.qty]));
  const userCollection = new Map(allCards.map(c => [c.name, c.qty]));

  return {
    deckCards: deckCards.size > 0 ? deckCards : undefined,
    userCollection: userCollection.size > 0 ? userCollection : undefined,
    format: detectedFormat,
    userBudget: budget,
  };
}
