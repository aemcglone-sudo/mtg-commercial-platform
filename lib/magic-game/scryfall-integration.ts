/**
 * Scryfall Integration
 * Fetch real Magic cards and build decks
 */

import type { ScryfallCard } from './commander-types';

const SCRYFALL_API = 'https://api.scryfall.com';

/**
 * Check if a card is a valid commander
 */
export function isValidCommander(card: ScryfallCard): boolean {
  // Legendary Creature — any card with both Legendary supertype and Creature type
  const isLegendaryCreature =
    card.type_line?.includes('Legendary') &&
    card.type_line?.includes('Creature');

  if (isLegendaryCreature) return true;

  // Legendary Planeswalker with explicit commander text
  const isLegendaryPlaneswalker =
    card.type_line?.includes('Legendary') &&
    card.type_line?.includes('Planeswalker');

  if (isLegendaryPlaneswalker && card.oracle_text?.includes('can be your commander')) {
    return true;
  }

  // Partner/Friends forever keywords
  const hasPartner = card.keywords?.includes('partner');
  const hasFriendsFotever = card.keywords?.includes('friends_forever');
  if (hasPartner || hasFriendsFotever) return true;

  // Choose a Background
  if (card.keywords?.includes('choose_a_background')) return true;

  return false;
}

/**
 * Fetch a card by name
 */
export async function fetchCardByName(name: string): Promise<ScryfallCard | null> {
  try {
    const url = `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(name)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MTGDeckBuilder/1.0'
      }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.log(`Scryfall error for "${name}": ${response.status} - ${text.substring(0, 100)}`);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching card "${name}":`, error);
    return null;
  }
}

/**
 * Search cards by criteria (fuzzy match)
 */
export async function searchCards(query: string, limit: number = 10): Promise<ScryfallCard[]> {
  try {
    const response = await fetch(
      `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=rating&dir=desc&page=1`,
      {
        headers: {
          'User-Agent': 'MTGDeckBuilder/1.0'
        }
      }
    );

    if (!response.ok) {
      console.log(`Scryfall search error: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.data?.slice(0, limit) || [];
  } catch (error) {
    console.error('Error searching cards:', error);
    return [];
  }
}

/**
 * Find a commander by partial name (fuzzy search)
 */
export async function findCommanderByName(name: string): Promise<ScryfallCard | null> {
  try {
    // Try exact match first
    let commander = await fetchCardByName(name);
    if (commander && isValidCommander(commander)) {
      return commander;
    }

    // Try searching for legendary creatures with partial name
    const results = await searchCards(`type:legendary type:creature "${name}"`, 10);

    if (results.length > 0) {
      // Find exact name match first
      const exactMatch = results.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (exactMatch && isValidCommander(exactMatch)) {
        return exactMatch;
      }

      // Find partial match (card name contains the search term)
      const partialMatch = results.find(c =>
        c.name.toLowerCase().includes(name.toLowerCase()) && isValidCommander(c)
      );
      if (partialMatch) {
        return partialMatch;
      }

      // Return first valid commander from results
      const firstValid = results.find(c => isValidCommander(c));
      if (firstValid) {
        return firstValid;
      }
    }

    console.log(`Commander not found: ${name}`);
    return null;
  } catch (error) {
    console.error(`Error finding commander "${name}":`, error);
    return null;
  }
}

/**
 * Get random cards for a color identity
 */
export async function getCardsForColorIdentity(colorIdentity: string[], count: number = 99): Promise<ScryfallCard[]> {
  try {
    // Build query for color identity
    const colorQuery = colorIdentity.length > 0
      ? `id:${colorIdentity.sort().join('')}`
      : 'is:legal';

    const response = await fetch(
      `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(colorQuery)} legal:commander type:land)&unique=cards&order=random&page=1`
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.data?.slice(0, count) || [];
  } catch (error) {
    console.error('Error fetching color cards:', error);
    return [];
  }
}

/**
 * Generate a Commander deck (100 cards: 1 commander + 99 others)
 */
export async function generateCommanderDeck(
  commanderName: string
): Promise<ScryfallCard[]> {
  // Use improved search that handles partial names better
  const commander = await findCommanderByName(commanderName);

  if (!commander) {
    console.log(`Commander not found: ${commanderName}`);
    return [];
  }

  // Validate commander eligibility
  if (!isValidCommander(commander)) {
    console.log(`Invalid commander: ${commander.name} - must be a legendary creature, planeswalker with commander text, or have partner/background keywords`);
    return [];
  }

  // Analyze commander strategy for synergistic deck building
  const { analyzeCommanderStrategy, rankCardsBySynergy } = await import('./deck-synergy');
  const strategy = analyzeCommanderStrategy(commander);
  console.log(`Building ${commander.name} deck - Primary strategy: ${strategy.primary}`);

  const colorIdentity = commander.color_identity || [];
  const seen = new Set<string>([commander.name]); // Track used cards for singleton rule
  const deck: ScryfallCard[] = [commander];

  // Add basic lands (allow duplicates)
  const basicLands: Record<string, string> = {
    'W': 'Plains',
    'U': 'Island',
    'B': 'Swamp',
    'R': 'Mountain',
    'G': 'Forest',
  };

  const basicPromises = colorIdentity.map(async (color) => {
    const basicName = basicLands[color];
    if (basicName) {
      const basic = await fetchCardByName(basicName);
      if (basic) {
        return Array(3).fill(basic); // 3 copies of each basic
      }
    }
    return [];
  });

  const basicResults = await Promise.all(basicPromises);
  const lands = basicResults.flat();
  deck.push(...lands);

  // Fetch cards following deck building best practices
  const colorStr = colorIdentity.length > 0
    ? `id:${colorIdentity.sort().join('')}`
    : 'is:legal'; // Colorless commander - can use any cards

  // Fetch specific card categories for balanced deck composition
  const [
    manaRamp,      // Ramp spells (8-10 pieces)
    cardDraw,      // Card draw (8-10 pieces)
    removal,       // Targeted removal (8-10 pieces)
    boardWipes,    // Mass interaction (2-3 pieces)
    creatures,     // Creatures as threats/win conditions
    otherSpells,   // Other spells
    utilities      // Utility and synergies
  ] = await Promise.all([
    searchCards(`${colorStr} (mana "add" OR ramp) -is:reserved type:spell`, 15),
    searchCards(`${colorStr} ("draw" or search library) -is:reserved type:spell`, 15),
    searchCards(`${colorStr} ("destroy target" OR "exile target") -is:reserved type:spell`, 15),
    searchCards(`${colorStr} ("destroy all" OR "exile all") -is:reserved type:spell`, 5),
    searchCards(`${colorStr} type:creature -is:reserved -power:0`, 40),
    searchCards(`${colorStr} type:instant OR type:sorcery -is:reserved`, 30),
    searchCards(`${colorStr} -type:land -is:reserved`, 25)
  ]);

  // Filter all cards to respect color identity
  const filterByColorIdentity = (card: ScryfallCard, allowedColors: string[]): boolean => {
    if (allowedColors.length === 0) return true; // Colorless commander

    const cardColors = card.color_identity || [];
    return cardColors.every(color => allowedColors.includes(color));
  };

  // Organize cards by function for Rule of Nine
  const filteredRamp = manaRamp.filter(c => filterByColorIdentity(c, colorIdentity));
  const filteredDraw = cardDraw.filter(c => filterByColorIdentity(c, colorIdentity));
  const filteredRemoval = removal.filter(c => filterByColorIdentity(c, colorIdentity));
  const filteredWipes = boardWipes.filter(c => filterByColorIdentity(c, colorIdentity));
  const filteredCreatures = creatures.filter(c => filterByColorIdentity(c, colorIdentity));
  const filteredOther = otherSpells
    .concat(utilities)
    .filter(c => filterByColorIdentity(c, colorIdentity));

  // Rank by synergy
  const rankedRamp = rankCardsBySynergy(filteredRamp, commander, strategy).slice(0, 9);
  const rankedDraw = rankCardsBySynergy(filteredDraw, commander, strategy).slice(0, 9);
  const rankedRemoval = rankCardsBySynergy(filteredRemoval, commander, strategy).slice(0, 9);
  const rankedWipes = rankCardsBySynergy(filteredWipes, commander, strategy).slice(0, 3);
  const rankedCreatures = rankCardsBySynergy(filteredCreatures, commander, strategy).slice(0, 20);
  const rankedOther = rankCardsBySynergy(filteredOther, commander, strategy).slice(0, 15);

  // Build deck following Rule of Nine (36-38 lands + 8-10 each of ramp/draw/removal + 2-3 wipes + rest)
  const allCategorized = [
    ...rankedRamp,
    ...rankedDraw,
    ...rankedRemoval,
    ...rankedWipes,
    ...rankedCreatures,
    ...rankedOther
  ];

  // Add cards to deck while respecting singleton rule
  for (const card of allCategorized) {
    if (deck.length >= 100) break;

    const isBasicLand = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(card.name);

    if (!seen.has(card.name) || isBasicLand) {
      deck.push(card);
      if (!isBasicLand) {
        seen.add(card.name);
      }
    }
  }

  // Fill remaining slots with basics and utility lands to reach 100
  const targetLands = 37; // Rule of Nine: 36-38 lands
  while (deck.length < 100) {
    const basicCard = lands[Math.floor(Math.random() * lands.length)];
    if (basicCard) {
      deck.push(basicCard);
    } else {
      break;
    }
  }

  // Shuffle and ensure exactly 100 cards
  const shuffled = deck.slice(0, 100).sort(() => Math.random() - 0.5);
  console.log(`Generated ${shuffled.length}-card deck for ${commanderName}`);
  return shuffled;
}

/**
 * Check if card is legal in Commander
 */
export function isLegalInCommander(card: ScryfallCard): boolean {
  return card.legalities?.['commander'] === 'legal';
}

/**
 * Parse mana from cost string (simplified)
 */
export function parseMana(manaCost: string): number {
  if (!manaCost) return 0;

  let total = 0;
  let i = 0;

  while (i < manaCost.length) {
    if (manaCost[i] === '{') {
      const end = manaCost.indexOf('}', i);
      if (end !== -1) {
        const content = manaCost.substring(i + 1, end);
        const num = parseInt(content);
        if (!isNaN(num)) {
          total += num;
        } else if (content.length === 1) {
          // Color mana counts as 1
          total += 1;
        }
        i = end + 1;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return total;
}

/**
 * Get card image URL
 */
export function getCardImageUrl(card: ScryfallCard): string {
  return card.image_uris?.normal || 'https://via.placeholder.com/223x310?text=' + encodeURIComponent(card.name);
}
