export interface Combo {
  cards: string[];
  description: string;
  result: string;
}

const KNOWN_COMBOS: Combo[] = [
  { cards: ["Thassa's Oracle", 'Demonic Consultation'], description: 'Mill yourself to win', result: 'Win the game' },
  { cards: ["Thassa's Oracle", 'Tainted Pact'], description: 'Mill yourself to win', result: 'Win the game' },
  { cards: ['Kiki-Jiki, Mirror Breaker', 'Restoration Angel'], description: 'Infinite blink loop', result: 'Infinite tokens' },
  { cards: ['Kiki-Jiki, Mirror Breaker', 'Deceiver Exarch'], description: 'Splinter Twin variant', result: 'Infinite tokens' },
  { cards: ['Splinter Twin', 'Pestermite'], description: 'Classic Modern combo', result: 'Infinite tokens' },
  { cards: ['Splinter Twin', 'Deceiver Exarch'], description: 'Classic Modern combo', result: 'Infinite tokens' },
  { cards: ['Basalt Monolith', 'Rings of Brighthearth'], description: 'Mana loop', result: 'Infinite colorless mana' },
  { cards: ['Grim Monolith', 'Power Artifact'], description: 'Mana loop', result: 'Infinite colorless mana' },
  { cards: ['Isochron Scepter', 'Dramatic Reversal'], description: 'Infinite mana with rocks', result: 'Infinite mana' },
  { cards: ['Heliod, Sun-Crowned', 'Walking Ballista'], description: 'Gain life loop', result: 'Infinite damage' },
  { cards: ['Mikaeus, the Unhallowed', 'Triskelion'], description: 'Persist loop', result: 'Infinite damage' },
  { cards: ['Mikaeus, the Unhallowed', 'Walking Ballista'], description: 'Persist loop', result: 'Infinite damage' },
  { cards: ['Exquisite Blood', 'Sanguine Bond'], description: 'Life gain/loss loop', result: 'Win the game' },
  { cards: ['Exquisite Blood', 'Vito, Thorn of the Dusk Rose'], description: 'Life gain/loss loop', result: 'Win the game' },
  { cards: ['Dramatic Reversal', 'Isochron Scepter'], description: 'Infinite mana with rocks', result: 'Infinite mana' },
  { cards: ['Doomsday', "Thassa's Oracle"], description: 'Pile win', result: 'Win the game' },
  { cards: ['Auriok Salvagers', 'Lion\'s Eye Diamond'], description: 'Infinite mana', result: 'Infinite mana' },
  { cards: ['Painter\'s Servant', 'Grindstone'], description: 'Mill opponent', result: 'Mill opponent out' },
  { cards: ['Dark Depths', 'Thespian\'s Stage'], description: 'Copy Dark Depths', result: '20/20 Marit Lage token' },
  { cards: ['Urza, Lord High Artificer', 'Isochron Scepter'], description: 'Mana engine', result: 'Infinite mana with artifacts' },
  { cards: ['Thoracle', 'Consultation'], description: 'Shorthand for Oracle/Consultation', result: 'Win the game' },
  { cards: ['Food Chain', 'Eternal Scourge'], description: 'Exile loop for mana', result: 'Infinite creature mana' },
  { cards: ['Food Chain', 'Misthollow Griffin'], description: 'Exile loop for mana', result: 'Infinite creature mana' },
  { cards: ['Omniscience', 'Enter the Infinite'], description: 'Draw and play everything', result: 'Win the game' },
  { cards: ['Tooth and Nail', 'Kiki-Jiki, Mirror Breaker'], description: 'Tutor the pieces', result: 'Win the game' },
  { cards: ['Staff of Domination', 'Selvala, Heart of the Wilds'], description: 'Mana engine', result: 'Infinite mana and cards' },
  { cards: ['Devoted Druid', 'Vizier of Remedies'], description: 'Persist mana loop', result: 'Infinite green mana' },
  { cards: ['Devoted Druid', 'Ezuri, Renegade Leader'], description: 'Elves engine', result: 'Infinite mana into overrun' },
  { cards: ['Niv-Mizzet, Parun', 'Curiosity'], description: 'Draw-damage loop', result: 'Infinite damage and draw' },
  { cards: ['Niv-Mizzet, the Firemind', 'Curiosity'], description: 'Draw-damage loop', result: 'Infinite damage and draw' },
  { cards: ['Niv-Mizzet, Parun', 'Ophidian Eye'], description: 'Draw-damage loop', result: 'Infinite damage and draw' },
];

export function findCombos(ownedCardNames: string[]): Combo[] {
  const owned = new Set(ownedCardNames.map(n => n.toLowerCase()));
  return KNOWN_COMBOS.filter(combo =>
    combo.cards.every(card => owned.has(card.toLowerCase()))
  );
}
