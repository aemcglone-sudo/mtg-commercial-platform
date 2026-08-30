/**
 * Bundled sample decks for the 3 AI opponents on the game table. Modest,
 * ~40-card decks (not full 99-card Commander lists) so the AI's decision
 * loop stays fast and easy to reason about — this is a practice tool, not
 * a format-legal deck simulator.
 */
export const AI_DECKS: { name: string; commander: string; list: string }[] = [
  {
    name: 'Goblin Aggro',
    commander: 'Krenko, Mob Boss',
    list: `1 Goblin Guide
1 Monastery Swiftspear
1 Kird Ape
1 Grim Lavamancer
1 Goblin Piledriver
1 Legion Loyalist
1 Reckless Bushwhacker
1 Zurgo Bellstriker
1 Vexing Devil
1 Foundry Street Denizen
1 Fanatical Firebrand
1 Bomat Courier
1 Hellspark Elemental
1 Lightning Bolt
1 Lava Spike
1 Chain Lightning
1 Rift Bolt
1 Skewer the Critics
1 Searing Blaze
1 Reckless Charge
16 Mountain`,
  },
  {
    name: 'Elemental Value',
    commander: 'Prime Speaker Vannifar',
    list: `1 Llanowar Elves
1 Elvish Mystic
1 Farhaven Elf
1 Wood Elves
1 Solemn Simulacrum
1 Eternal Witness
1 Acidic Slime
1 Sun Titan
1 Grave Titan
1 Craterhoof Behemoth
1 Baleful Strix
1 Mulldrifter
1 Shriekmaw
1 Reclamation Sage
1 Beast Within
1 Cultivate
1 Kodama's Reach
1 Nature's Lore
1 Sign in Blood
8 Forest
9 Swamp`,
  },
  {
    name: 'Spirit Control',
    commander: 'Kess, Dissident Mage',
    list: `1 Mystic Confluence
1 Cryptic Command
1 Counterspell
1 Negate
1 Swords to Plowshares
1 Path to Exile
1 Wrath of God
1 Supreme Verdict
1 Toxic Deluge
1 Brainstorm
1 Ponder
1 Consecrated Sphinx
1 Baleful Strix
1 Snapcaster Mage
1 Restoration Angel
1 Archon of Cruelty
1 Rhystic Study
1 Smothering Tithe
1 Fatal Push
1 Doom Blade
6 Plains
6 Island
5 Swamp`,
  },
];
