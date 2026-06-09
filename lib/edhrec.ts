/**
 * Fetches Commander deck recommendations from EDHREC.
 * The list endpoint is blocked, so we use a curated list of popular commanders
 * and fetch their individual pages (which do work).
 * Results are cached in memory for 1 hour.
 */

export interface EdhrecDeck {
  commanderName: string;
  commanderSlug: string;
  cards: Map<string, number>;
}

/** Top commanders by EDHREC popularity — updated periodically */
const POPULAR_COMMANDERS: Array<{ name: string; slug: string }> = [
  { name: 'Atraxa, Praetors\' Voice', slug: 'atraxa-praetors-voice' },
  { name: 'Ur-Dragon, the', slug: 'ur-dragon-the' },
  { name: 'Edgar Markov', slug: 'edgar-markov' },
  { name: 'Korvold, Fae-Cursed King', slug: 'korvold-fae-cursed-king' },
  { name: 'Prosper, Tome-Bound', slug: 'prosper-tome-bound' },
  { name: 'Yuriko, the Tiger\'s Shadow', slug: 'yuriko-the-tigers-shadow' },
  { name: 'Meren of Clan Nel Toth', slug: 'meren-of-clan-nel-toth' },
  { name: 'Kenrith, the Returned King', slug: 'kenrith-the-returned-king' },
  { name: 'Omnath, Locus of Creation', slug: 'omnath-locus-of-creation' },
  { name: 'Kinnan, Bonder Prodigy', slug: 'kinnan-bonder-prodigy' },
  { name: 'Xyris, the Writhing Storm', slug: 'xyris-the-writhing-storm' },
  { name: 'Tymna the Weaver', slug: 'tymna-the-weaver' },
  { name: 'Kaalia of the Vast', slug: 'kaalia-of-the-vast' },
  { name: 'Syr Konrad, the Grim', slug: 'syr-konrad-the-grim' },
  { name: 'Nekusar, the Mindrazer', slug: 'nekusar-the-mindrazer' },
  { name: 'Grenzo, Dungeon Warden', slug: 'grenzo-dungeon-warden' },
  { name: 'Xenagos, God of Revels', slug: 'xenagos-god-of-revels' },
  { name: 'Breya, Etherium Shaper', slug: 'breya-etherium-shaper' },
  { name: 'Wilhelt, the Rotcleaver', slug: 'wilhelt-the-rotcleaver' },
  { name: 'Winota, Joiner of Forces', slug: 'winota-joiner-of-forces' },
];

interface EdhrecCardView {
  name: string;
  num_decks?: number;
  potential_decks?: number;
}

interface EdhrecPage {
  container?: {
    json_dict?: {
      cardlists?: Array<{
        header: string;
        cardviews: EdhrecCardView[];
      }>;
    };
  };
}

const deckCache = new Map<string, { deck: EdhrecDeck | null; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function fetchCommanderDeck(
  slug: string,
  commanderName: string
): Promise<EdhrecDeck | null> {
  const cached = deckCache.get(slug);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.deck;

  try {
    const res = await fetch(`https://json.edhrec.com/pages/commanders/${slug}.json`);
    if (!res.ok) return null;
    const data: EdhrecPage = await res.json();

    const cardlists = data?.container?.json_dict?.cardlists ?? [];
    const cards = new Map<string, number>();

    // Add the commander
    const primaryName = commanderName.split(' // ')[0];
    cards.set(primaryName, 1);

    // Build ~98 more cards from EDHREC recommendations (sorted by inclusion %)
    // Take top cards from each section, up to ~98 total
    const allCardViews: EdhrecCardView[] = [];
    for (const section of cardlists) {
      for (const cv of section.cardviews) {
        if (cv.name && !cards.has(cv.name)) {
          allCardViews.push(cv);
        }
      }
    }

    // Sort by inclusion rate descending
    allCardViews.sort((a, b) => {
      const rateA = a.num_decks && a.potential_decks ? a.num_decks / a.potential_decks : 0;
      const rateB = b.num_decks && b.potential_decks ? b.num_decks / b.potential_decks : 0;
      return rateB - rateA;
    });

    // Fill to 99 cards (commander already added = 1)
    for (const cv of allCardViews) {
      if (cards.size >= 99) break;
      const isBasic = /^(Plains|Island|Swamp|Mountain|Forest|Wastes)$/.test(cv.name);
      cards.set(cv.name, isBasic ? 3 : 1);
    }

    if (cards.size < 20) {
      deckCache.set(slug, { deck: null, ts: Date.now() });
      return null;
    }

    const deck = { commanderName, commanderSlug: slug, cards };
    deckCache.set(slug, { deck, ts: Date.now() });
    return deck;
  } catch {
    return cached?.deck ?? null;
  }
}

export function getPopularCommanders() {
  return POPULAR_COMMANDERS;
}
