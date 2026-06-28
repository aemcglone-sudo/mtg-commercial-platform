import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const FORMATS = [
  // Constructed
  { id: 'standard', label: 'Standard', category: 'constructed', deckSize: 60, sideboard: 15, singleton: false, popular: true,
    description: 'Rotating format using only the most recent sets.',
    rules: 'Build a 60-card deck using only cards from currently legal Standard sets. Rotation happens each autumn when the oldest sets cycle out. A 15-card sideboard is optional for best-of-three matches.' },
  { id: 'pioneer', label: 'Pioneer', category: 'constructed', deckSize: 60, sideboard: 15, singleton: false, popular: true,
    description: 'Non-rotating from Return to Ravnica (2012) forward.',
    rules: 'Build a 60-card deck using cards printed from Return to Ravnica (2012) onward. No fetchlands (Scalding Tarn, Verdant Catacombs, etc.). Non-rotating — your cards never leave the format.' },
  { id: 'modern', label: 'Modern', category: 'constructed', deckSize: 60, sideboard: 15, singleton: false, popular: true,
    description: 'Non-rotating from 8th Edition (2003) forward. Fast and complex.',
    rules: 'Build a 60-card deck using cards printed from 8th Edition (2003) onward. One of the fastest non-rotating formats. Highly tuned decks that win as early as turn 3.' },
  { id: 'legacy', label: 'Legacy', category: 'constructed', deckSize: 60, sideboard: 15, singleton: false,
    description: 'Full card pool from all of Magic history.',
    rules: 'Build a 60-card deck from Magic\'s entire history (minus banned cards). Powerful and expensive format with access to dual lands and broken spells. Ban list applies.' },
  { id: 'vintage', label: 'Vintage', category: 'constructed', deckSize: 60, sideboard: 15, singleton: false,
    description: 'Most powerful format. Full card pool with restricted list instead of bans.',
    rules: 'Build a 60-card deck from all of Magic history. Instead of a ban list, the most powerful cards are restricted to 1 copy each (Ancestral Recall, Black Lotus, Power Nine, etc.).' },
  { id: 'pauper', label: 'Pauper', category: 'constructed', deckSize: 60, sideboard: 15, singleton: false,
    description: 'Commons only — budget-friendly and surprisingly powerful.',
    rules: 'Build a 60-card deck using only cards that have been printed at common rarity in any official Magic set. Surprisingly deep format with powerful staples.' },
  { id: 'historic', label: 'Historic', category: 'constructed', deckSize: 60, sideboard: 15, singleton: false,
    description: 'Arena-only. Includes Anthologies and rebalanced cards.',
    rules: 'Arena format using all cards available on Magic Arena, including Anthology additions and cards not found in Standard. Some cards exist only in digital form.' },
  { id: 'timeless', label: 'Timeless', category: 'constructed', deckSize: 60, sideboard: 15, singleton: false,
    description: 'Arena\'s most powerful format — no ban list.',
    rules: 'Arena format with no ban list. The most powerful cards available on Arena are legal. Expect degenerate combos and the strongest strategies the platform offers.' },
  // Commander
  { id: 'commander', label: 'Commander', category: 'commander', deckSize: 100, sideboard: 0, singleton: true, popular: true,
    description: '100-card singleton. Legendary creature leads your deck.',
    rules: 'Build a 100-card deck with no duplicates (except basic lands). Choose one legendary creature or planeswalker as your Commander — it starts outside the game and can be cast from the command zone. Every card must match your Commander\'s color identity. Multiplayer format, typically 4 players. Players start at 40 life. 21 commander damage from a single commander eliminates a player.' },
  { id: 'brawl', label: 'Brawl', category: 'commander', deckSize: 60, sideboard: 0, singleton: true,
    description: '60-card singleton. Standard-legal card pool.',
    rules: 'Build a 60-card singleton deck using only Standard-legal cards. Choose a legendary creature or planeswalker as your Commander. Color identity rules apply as in Commander.' },
  { id: 'oathbreaker', label: 'Oathbreaker', category: 'commander', deckSize: 60, sideboard: 0, singleton: true,
    description: 'Planeswalker commander + signature spell.',
    rules: 'Build a 60-card singleton deck. Your commander is a planeswalker. You also choose one instant or sorcery as your Signature Spell — it must match the planeswalker\'s color identity. Both start in the command zone.' },
  // Limited
  { id: 'draft', label: 'Draft', category: 'limited', deckSize: 40, sideboard: 0, singleton: false,
    description: 'Build a 40-card deck from your draft picks.',
    rules: 'After drafting, build a minimum 40-card deck using only cards you picked. The wizard operates in Pool Mode — enter your picks and get Khoa\'s recommended build from your pool.' },
  { id: 'sealed', label: 'Sealed', category: 'limited', deckSize: 40, sideboard: 0, singleton: false,
    description: 'Build a 40-card deck from your sealed pool.',
    rules: 'After opening your sealed pool (typically 6 booster packs), build a minimum 40-card deck using only those cards. The wizard helps you identify your best color pair and optimal build.' },
  // Casual
  { id: 'canadian_highlander', label: 'Canadian Highlander', category: 'casual', deckSize: 100, sideboard: 0, singleton: true,
    description: '100-card singleton with a point system instead of a ban list.',
    rules: 'Build a 100-card singleton deck. No ban list — instead, the most powerful cards have point values. Your deck\'s total points must be 10 or under. Allows unfettered access to powerful cards while keeping the format balanced.' },
  { id: 'tiny_leaders', label: 'Tiny Leaders', category: 'casual', deckSize: 50, sideboard: 0, singleton: true,
    description: '50-card singleton where every card must cost 3 or less.',
    rules: 'Build a 50-card singleton deck. Your commander must have a converted mana cost of 3 or less. Every other card in the deck must also have a CMC of 3 or less. Lightning-fast games.' },
  { id: 'penny_dreadful', label: 'Penny Dreadful', category: 'casual', deckSize: 60, sideboard: 15, singleton: false,
    description: 'Cards must be worth under $0.01 on MTGO.',
    rules: 'Build a 60-card deck using only cards worth less than $0.01 on Magic Online at the start of the current season. Rotates seasonally. Forces creativity with cheap bulk cards.' },
];

export async function GET() {
  return NextResponse.json({ formats: FORMATS });
}
