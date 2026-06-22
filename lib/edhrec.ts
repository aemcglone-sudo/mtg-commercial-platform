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
const POPULAR_COMMANDERS: Array<{ name: string; slug: string; strategy: string }> = [
  { name: 'Atraxa, Praetors\' Voice', slug: 'atraxa-praetors-voice', strategy: 'A 4-color proliferate engine that spreads +1/+1 counters, planeswalker loyalty, and infect counters across the board. Wins by overwhelming opponents with an ever-growing army or by ticking planeswalkers up to their ultimates.' },
  { name: 'Ur-Dragon, the', slug: 'ur-dragon-the', strategy: '5-color Dragon tribal that ramps into massive flying threats. The Ur-Dragon lets you draw cards and put permanents into play for free whenever a Dragon attacks, turning each combat step into a cascading value engine.' },
  { name: 'Edgar Markov', slug: 'edgar-markov', strategy: 'Mardu Vampire tribal aggro. Every Vampire you cast creates a 1/1 token from the command zone for free, flooding the board fast. Wins through wide attacks buffed by Edgar\'s eminence ability and vampire lords.' },
  { name: 'Korvold, Fae-Cursed King', slug: 'korvold-fae-cursed-king', strategy: 'A Jund sacrifice engine where every permanent you sacrifice draws a card and grows Korvold. Combines token generators, food/treasure producers, and recursive creatures to fuel an endless loop of sacrifice, draw, and attack.' },
  { name: 'Prosper, Tome-Bound', slug: 'prosper-tome-bound', strategy: 'Rakdos exile-matters and treasure generation. Prosper creates a Treasure whenever you cast a spell from exile, while his ability impulse-draws the top card each turn. Uses wheels and mass-exile effects to generate explosive mana and card advantage.' },
  { name: 'Yuriko, the Tiger\'s Shadow', slug: 'yuriko-the-tigers-shadow', strategy: 'Blue-black Ninja and Rogue tribal built around the ninjutsu mechanic. Cheap unblockable creatures sneak in, swap for Yuriko, and drain every opponent for the mana cost of the top card. Top-deck manipulation maximizes the damage dealt.' },
  { name: 'Meren of Clan Nel Toth', slug: 'meren-of-clan-nel-toth', strategy: 'Golgari graveyard recursion that grows an experience counter each time a creature dies. At end of turn, Meren returns a creature from the graveyard whose CMC is ≤ your experience total, enabling infinite loops with sacrifice outlets and ETB creatures.' },
  { name: 'Kenrith, the Returned King', slug: 'kenrith-the-returned-king', strategy: '5-color goodstuff with five activated abilities covering life gain, card draw, haste, recursion, and +1/+1 counters. Highly flexible and political — a favorite for Group Hug and Combo builds alike because any color of mana can be put to work.' },
  { name: 'Omnath, Locus of Creation', slug: 'omnath-locus-of-creation', strategy: '4-color landfall powerhouse. The first land each turn gains life, the second makes mana, the third deals 4 damage to each opponent. Pairs with land tutors and fetch lands to trigger landfall multiple times per turn and generate enormous tempo.' },
  { name: 'Kinnan, Bonder Prodigy', slug: 'kinnan-bonder-prodigy', strategy: 'Simic mana-doubler combo. Non-land mana sources tap for an extra mana, letting you rapidly assemble infinite mana with cards like Basalt Monolith. Then dump that mana into Kinnan\'s ability to cheat non-Human creatures directly onto the battlefield.' },
  { name: 'Xyris, the Writhing Storm', slug: 'xyris-the-writhing-storm', strategy: 'Temur wheel and snake tribal. Whenever an opponent draws a card outside their draw step, Xyris creates a Snake token — so mass-draw effects like Windfall and Wheel of Fortune generate a flood of 1/1s while refilling everyone\'s hand.' },
  { name: 'Tymna the Weaver', slug: 'tymna-the-weaver', strategy: 'Orzhov low-to-the-ground combat focused on hitting multiple opponents to draw cards. Pairs with a Partner commander (commonly Thrasios or Kraum) and relies on evasive weenies plus life-drain effects to accumulate card advantage through combat.' },
  { name: 'Kaalia of the Vast', slug: 'kaalia-of-the-vast', strategy: 'Mardu cheat-into-play for Angels, Demons, and Dragons. When Kaalia attacks, you can put any Angel, Demon, or Dragon from your hand onto the battlefield tapped and attacking for free — enabling explosive turns with high-CMC finishers like Avacyn or Razaketh.' },
  { name: 'Syr Konrad, the Grim', slug: 'syr-konrad-the-grim', strategy: 'Mono-black mill and death-trigger drain. Syr Konrad deals 1 damage to each opponent whenever a creature dies, leaves the graveyard, or is milled. Combine with mass mill spells, Altar of Dementia, and recursive creatures to drain the whole table at once.' },
  { name: 'Nekusar, the Mindrazer', slug: 'nekusar-the-mindrazer', strategy: 'Grixis group-draw punishment. Nekusar deals 1 damage to each opponent for every card they draw, and wheel effects make everyone draw many cards at once. Win by chaining Wheel of Fortune, Windfall, and similar spells to kill opponents with their own draws.' },
  { name: 'Grenzo, Dungeon Warden', slug: 'grenzo-dungeon-warden', strategy: 'Rakdos bottom-of-library creature cheating. Grenzo\'s activated ability puts the bottom card of your library onto the battlefield if it\'s a creature with power ≤ his power. Stacking the bottom of your deck with Doomsday or tutors turns this into an instant-win combo.' },
  { name: 'Xenagos, God of Revels', slug: 'xenagos-god-of-revels', strategy: 'Gruul voltron and creature-based aggro. When a creature attacks, Xenagos doubles its power and grants haste until end of turn. Pair with high-power creatures like Ghalta or Blightsteel Colossus to deliver lethal commander damage in a single swing.' },
  { name: 'Breya, Etherium Shaper', slug: 'breya-etherium-shaper', strategy: '4-color Artifact combo that assembles infinite loops using Thopter Foundry, Sword of the Meek, and Nim Deathmantle. Breya herself sacrifices artifacts to drain life, deal damage, or destroy threats, serving as both a combo piece and a flexible removal engine.' },
  { name: 'Wilhelt, the Rotcleaver', slug: 'wilhelt-the-rotcleaver', strategy: 'Dimir Zombie tribal with a death-trigger payoff. When a non-token Zombie you control dies, Wilhelt creates a 2/2 Zombie token with decayed — perfect sacrifice fodder. At end of turn you can sacrifice a Zombie to draw a card, converting your dead tokens into cards.' },
  { name: 'Winota, Joiner of Forces', slug: 'winota-joiner-of-forces', strategy: 'Boros combo-aggro that cheats Humans into play. Whenever a non-Human attacks, you reveal cards until you find a Human and put it onto the battlefield attacking for free. With enough non-Humans attacking, you can deploy your whole hand in a single combat step.' },
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
