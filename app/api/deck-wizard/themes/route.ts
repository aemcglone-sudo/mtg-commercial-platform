import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const ARCHETYPES = [
  { id: 'aggro', label: 'Aggro', icon: '⚡', description: 'Play cheap, fast creatures on turns 1–3 and deal 20 damage before the opponent stabilizes. Every card costs 3 or less. You win by turn 4–5 or you lose.', playstyle: 'You\'re always attacking. If you\'re not attacking, you\'re losing.', difficulty: 'beginner' },
  { id: 'control', label: 'Control', icon: '🛡️', description: 'Answer every threat with a counterspell or removal spell, then win with one powerful finisher when the opponent is out of resources. Heavy on instants and card draw.', playstyle: 'You say no to everything. The fun is staying alive long enough to win on your terms.', difficulty: 'advanced' },
  { id: 'midrange', label: 'Midrange', icon: '⚖️', description: 'Play the most efficient cards at every mana cost. Beat aggro by having bigger creatures; beat control by having too many threats. The deck that beats whatever is popular.', playstyle: 'You\'re flexible — you can play fast or slow depending on what your opponent is doing.', difficulty: 'intermediate' },
  { id: 'combo', label: 'Combo', icon: '🔮', description: 'Build toward assembling 2–3 specific cards that instantly win the game. Everything else in the deck either finds those pieces or buys time to find them.', playstyle: 'You\'re solving a puzzle while your opponent tries to stop you. One turn you\'re behind; next turn you win.', difficulty: 'advanced' },
  { id: 'tempo', label: 'Tempo', icon: '🌊', description: 'Play cheap threats and cheap interaction at the same time. Bounce or counter the opponent\'s key spells while your creatures keep attacking. Win before they recover.', playstyle: 'You\'re always one step ahead. You play a threat AND answer their threat on the same turn.', difficulty: 'advanced' },
  { id: 'prison', label: 'Prison / Stax', icon: '⛓️', description: 'Play permanents that deny the opponent mana, cards, or the ability to act. Win through accumulated advantage while they\'re stuck. Opponents will hate you.', playstyle: 'You\'re not playing Magic — you\'re making sure your opponent can\'t play Magic either.', difficulty: 'advanced' },
  { id: 'ramp', label: 'Ramp', icon: '🌲', description: 'Use the early turns to generate far more mana than normal, then cast enormous spells that smaller decks can\'t answer. A turn-4 10-mana spell wins games.', playstyle: 'Your early turns look weak. Your late turns look impossible to stop.', difficulty: 'beginner' },
];

const STRATEGY_THEMES = [
  { id: 'tokens', label: 'Tokens', description: 'Make many small creatures; win through numbers', colors: ['W','G','R','B'], difficulty: 'beginner' },
  { id: 'aristocrats', label: 'Aristocrats', description: 'Sacrifice creatures on purpose for value; death is a resource', colors: ['B','W','R'], difficulty: 'intermediate' },
  { id: 'reanimator', label: 'Reanimator', description: 'Fill graveyard cheaply; reanimate large creatures for a fraction of their cost', colors: ['B','U','W'], difficulty: 'intermediate' },
  { id: 'mill', label: 'Mill', description: 'Win by emptying the opponent\'s library instead of reducing life to zero', colors: ['U','B'], difficulty: 'intermediate' },
  { id: 'burn', label: 'Burn', description: 'Deal damage directly to the opponent with spells; forget creatures', colors: ['R'], difficulty: 'beginner' },
  { id: 'voltron', label: 'Voltron', description: 'Make one creature unstoppably powerful; kill with commander damage', colors: ['W','G'], difficulty: 'intermediate' },
  { id: 'counters', label: 'Counters Matter', description: 'Proliferate +1/+1, loyalty, and poison counters', colors: ['G','W','U','B'], difficulty: 'intermediate' },
  { id: 'superfriends', label: 'Superfriends', description: 'Play as many planeswalkers as possible; protect and ultimate them', colors: ['U','W','B'], difficulty: 'advanced' },
  { id: 'spellslinger', label: 'Spellslinger', description: 'Win through casting many instants and sorceries; creatures are secondary', colors: ['U','R'], difficulty: 'advanced' },
  { id: 'landfall', label: 'Landfall', description: 'Trigger effects every time a land enters the battlefield', colors: ['G','R','U'], difficulty: 'intermediate' },
  { id: 'enchantress', label: 'Enchantress', description: 'Build around enchantments; draw cards as you cast them', colors: ['W','G','U'], difficulty: 'intermediate' },
  { id: 'artifacts', label: 'Artifacts Matter', description: 'Build around artifacts; cost reduction, sacrifice loops, or equipment', colors: ['U','W','C'], difficulty: 'intermediate' },
  { id: 'graveyard', label: 'Graveyard', description: 'Use the graveyard as a resource; flashback, escape, dredge', colors: ['B','G','U'], difficulty: 'advanced' },
  { id: 'lifegain', label: 'Lifegain', description: 'Gain life and exploit it for powerful triggers and scaling effects', colors: ['W','B'], difficulty: 'beginner' },
  { id: 'politics', label: 'Politics / Group Hug', description: 'In Commander: manipulate other players or give gifts with strings attached', colors: ['R','W','U'], difficulty: 'advanced' },
  { id: 'chaos', label: 'Chaos', description: 'Make the game unpredictable; coin flips, random effects', colors: ['R'], difficulty: 'advanced' },
  { id: 'infect', label: 'Infect', description: 'Deal damage as poison counters; 10 poison counters kills a player', colors: ['G','B'], difficulty: 'advanced' },
  { id: 'blink', label: 'Blink / Flicker', description: 'Repeatedly exile and return your own creatures for ETB triggers', colors: ['W','U'], difficulty: 'intermediate' },
  { id: 'eldrazi', label: 'Eldrazi Ramp', description: 'Build to massive mana, cast Eldrazi, devastate the board', colors: ['C'], difficulty: 'intermediate' },
];

const NAMED_ARCHETYPES = [
  { id: 'jund', label: 'Jund', formats: ['modern','pioneer'], description: 'Black/Red/Green midrange with discard, removal, and efficient threats' },
  { id: 'jeskai_control', label: 'Jeskai Control', formats: ['modern','pioneer'], description: 'White/Blue/Red control with burn as removal and win condition' },
  { id: 'sultai_midrange', label: 'Sultai Midrange', formats: ['modern','pioneer'], description: 'Black/Green/Blue value grind with graveyard interaction' },
  { id: 'dredge', label: 'Dredge', formats: ['modern','legacy'], description: 'Fill graveyard via Dredge mechanic; reanimate en masse' },
  { id: 'storm', label: 'Storm', formats: ['modern','legacy'], description: 'Cast many spells in one turn; win with Grapeshot or Empty the Warrens' },
  { id: 'affinity', label: 'Affinity / Robots', formats: ['modern'], description: 'Play artifacts; reduce spell costs via Affinity; win fast' },
  { id: 'tron', label: 'Tron', formats: ['modern'], description: 'Assemble Urza\'s lands for enormous mana; cast game-winning threats' },
  { id: 'death_taxes', label: 'Death & Taxes', formats: ['legacy','modern'], description: 'White hatebears that tax opponent\'s spells and mana' },
  { id: 'bogles', label: 'Bogles', formats: ['modern'], description: 'Hexproof creatures loaded with auras; opponent can\'t interact' },
  { id: 'hammertime', label: 'Hammertime', formats: ['modern'], description: 'Colossus Hammer equipped cheaply for one-hit kills' },
  { id: 'izzet_phoenix', label: 'Izzet Phoenix', formats: ['modern'], description: 'Recurring Arclight Phoenix via cheap spells; prowess beatdown' },
  { id: 'living_end', label: 'Living End', formats: ['modern'], description: 'Suspend Living End; cascade into it; reanimate your creatures' },
  { id: 'food_chain', label: 'Food Chain', formats: ['commander'], description: 'Infinite mana via Food Chain + Misthollow Griffin loop (cEDH)' },
  { id: 'thashas_oracle', label: "Thassa's Oracle", formats: ['commander'], description: 'Win with Oracle + Demonic Consultation or Tainted Pact (cEDH)' },
  { id: 'atraxa_superfriends', label: 'Atraxa Superfriends', formats: ['commander'], description: 'Proliferate planeswalker loyalty counters; ultimate frequently' },
  { id: 'edgar_vampires', label: 'Edgar Markov Vampires', formats: ['commander'], description: 'Create vampire tokens on cast; overwhelm with vampire army' },
  { id: 'krenko_goblins', label: 'Krenko Goblins', formats: ['commander'], description: 'Double goblin count each turn; lethal token swarm' },
];

const TRIBAL_THEMES = [
  { id: 'elves', label: 'Elves', deckCount: 22629, colors: ['G'], difficulty: 'beginner', description: 'Generate massive mana; swarm with lords; Overrun to win' },
  { id: 'zombies', label: 'Zombies', deckCount: 22286, colors: ['B','U'], difficulty: 'intermediate', description: 'Recursive; graveyard returns army; resilient to removal' },
  { id: 'vampires', label: 'Vampires', deckCount: 18679, colors: ['B','W','R'], difficulty: 'beginner', description: 'Lifelink aggression; Edgar Markov token swarm' },
  { id: 'humans', label: 'Humans', deckCount: 16484, colors: ['W'], difficulty: 'intermediate', description: 'Versatile; Champion of the Parish; Collected Company' },
  { id: 'angels', label: 'Angels', deckCount: 14307, colors: ['W'], difficulty: 'beginner', description: 'Big fliers; lifelink; Giada or Kaalia as commander' },
  { id: 'goblins', label: 'Goblins', deckCount: 14297, colors: ['R'], difficulty: 'beginner', description: 'Fast; Krenko exponential token generation; chaotic' },
  { id: 'dinosaurs', label: 'Dinosaurs', deckCount: 13922, colors: ['R','W','G'], difficulty: 'intermediate', description: 'Enrage triggers; trample; Gishath reveals from library' },
  { id: 'wizards', label: 'Wizards', deckCount: 9880, colors: ['U','R'], difficulty: 'advanced', description: 'Spell synergy; tap abilities; Inalla ETB copies' },
  { id: 'pirates', label: 'Pirates', deckCount: 9801, colors: ['U','B','R'], difficulty: 'intermediate', description: 'Treasure tokens; evasion; Beckett Brass steals permanents' },
  { id: 'cats', label: 'Cats', deckCount: 7781, colors: ['W','G'], difficulty: 'beginner', description: 'Lifelink; Arahbo free pump each turn' },
  { id: 'merfolk', label: 'Merfolk', deckCount: 7298, colors: ['U','G'], difficulty: 'beginner', description: 'Islandwalk; lords; tempo disruption' },
  { id: 'slivers', label: 'Slivers', deckCount: 7060, colors: ['W','U','B','R','G'], difficulty: 'intermediate', description: 'Every Sliver grants all Slivers a new ability; exponential' },
  { id: 'faeries', label: 'Faeries', deckCount: 6968, colors: ['U','B'], difficulty: 'advanced', description: 'Flash; flying; play at instant speed to deny information' },
  { id: 'knights', label: 'Knights', deckCount: 6840, colors: ['W','B','R'], difficulty: 'beginner', description: 'First strike; double strike; History of Benalia' },
  { id: 'dragons', label: 'Dragons', deckCount: 3829, colors: ['R'], difficulty: 'intermediate', description: 'Big mana; Dragon Tempest haste + damage; Scion tutoring' },
  { id: 'werewolves', label: 'Werewolves', deckCount: 3610, colors: ['R','G'], difficulty: 'intermediate', description: 'Day/Night transformation; Tovolar triggers; aggressive stats' },
  { id: 'spirits', label: 'Spirits', deckCount: 5034, colors: ['W','U'], difficulty: 'intermediate', description: 'Flash; flying; disruptive ETBs; Moorland Haunt recursion' },
  { id: 'elementals', label: 'Elementals', deckCount: 4126, colors: ['R','G','U','W'], difficulty: 'intermediate', description: 'Risen Reef draws cards; Omnath produces mana; ETB chains' },
  { id: 'ninjas', label: 'Ninjas', deckCount: 4153, colors: ['U','B'], difficulty: 'intermediate', description: 'Ninjutsu; sneak in when opponent is attacked; bounce synergies' },
  { id: 'squirrels', label: 'Squirrels', deckCount: 1200, colors: ['G'], difficulty: 'beginner', description: 'Chatterfang goes infinite easily; surprisingly competitive; very silly' },
  { id: 'treefolk', label: 'Treefolk', deckCount: 800, colors: ['G','W','B'], difficulty: 'intermediate', description: 'Doran makes high-toughness creatures deal toughness as damage' },
];

const PSYCHOGRAPHICS = [
  { id: 'spike', label: 'Winning as efficiently as possible', description: 'You want the most competitive option available' },
  { id: 'johnny', label: 'Pulling off a creative or surprising combo', description: 'You love the moment when your plan clicks together' },
  { id: 'timmy', label: 'Playing a huge, splashy threat that dominates the board', description: 'You want to cast something that makes the table say "wow"' },
  { id: 'vorthos', label: 'The flavor and story of the cards', description: 'You want cards that fit a theme or tell a cohesive story' },
  { id: 'melvin', label: 'How elegantly the cards interact with each other', description: 'You appreciate clean mechanical synergy above all else' },
];

export async function GET() {
  return NextResponse.json({ archetypes: ARCHETYPES, strategyThemes: STRATEGY_THEMES, namedArchetypes: NAMED_ARCHETYPES, tribalThemes: TRIBAL_THEMES, psychographics: PSYCHOGRAPHICS });
}
