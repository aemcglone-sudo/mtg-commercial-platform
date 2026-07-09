-- Khoa building rules derived from the MTG Commander Deck Rubric "Notes for AI Training" section.
-- These are hard deck-construction rules that supplement the existing ratio guidance.

INSERT INTO deck_rules (rule_text, category, scope, enforcement, sort_order, notes) VALUES

('Build exactly 100 cards — not 73, not 94, not 98. The deck is incomplete unless it has exactly 100 cards including the commander. Every role must be filled to hit the target count.', 'deck_size', 'commander', 'hard', 195, 'Most common failure mode: deck is short because a role returned too few cards.'),

('Calculate and fill the mana base LAST, after all non-land roles are filled. Never let land count crowd out spells. Fill creatures, ramp, draw, removal, and win conditions first, then fill remaining slots with lands.', 'ratios', 'commander', 'hard', 196, 'Basics are auto-added by fill-basics step — do not count them during card selection.'),

('Identify the commander''s primary synergies before suggesting ANY cards. If the commander specifically cares about a creature type (Ninjas, Pirates, Vampires), a keyword mechanic (ninjutsu, landfall, cascade), or a specific game action (dealing combat damage, casting instants), the majority of the non-land, non-utility cards must directly enable or benefit from that mechanic.', 'ratios', 'commander', 'hard', 197, 'Most important rule: the deck must match the commander''s strategy, not generic good-stuff.'),

('Every Commander deck must include cards from all of these categories: (1) creatures that advance the strategy, (2) mana ramp, (3) card draw or advantage, (4) spot removal, (5) board wipes, (6) win conditions or synergy payoffs. A deck missing any entire category is incomplete.', 'ratios', 'commander', 'hard', 198, 'A deck with only ramp and draw and no creatures or win conditions is not a deck.'),

('For tribal commanders (a commander whose ability references a specific creature type), include at least 15 creatures of that tribe. Tribal synergy cards (lords, anthem effects, tribal spells) count toward the tribe requirement. Generic creatures that share the type incidentally do not count — they must contribute to the tribal gameplan.', 'ratios', 'commander', 'soft', 199, 'Applies when commander oracle text names a creature type or commander has that type in its type line.'),

('Color distribution in the mana base must match the deck''s actual mana symbol requirements. Count colored mana symbols (W, U, B, R, G) across all non-land cards. A two-color deck should have roughly equal land ratios for each color. Never include off-color lands that cannot produce the deck''s colors.', 'ratios', 'commander', 'soft', 201, NULL),

('Include at least 8 mana rocks or land-ramp spells (not counting land drops). Sol Ring is mandatory in virtually all Commander decks. Arcane Signet is correct in almost every two-or-more-color deck. Never build a Commander deck with fewer than 6 ramp pieces.', 'ratios', 'commander', 'hard', 202, NULL),

('Include at least 6 card draw or card advantage sources. Repeatable draw engines (Rhystic Study, Phyrexian Arena, Beast Whisperer) are worth 2 one-shot draw spells. A deck with fewer than 4 card draw sources will run out of cards and lose.', 'ratios', 'commander', 'hard', 203, NULL),

('Never suggest a card that does not exist in Magic: The Gathering. If you are not certain a card exists with that exact name, do not suggest it. Card names are case-sensitive and must be exact. "Cryogen Relic", "Shadowmeld Ninja", and other invented names are never acceptable.', 'general', 'commander', 'hard', 204, 'Khoa has been observed hallucinating card names. This is never acceptable.'),

('Utility lands must be included in the mana base — not just basics. Every Commander deck should have Command Tower. Multicolor decks should include shock lands, check lands, or pain lands appropriate to their color identity. A mana base of 20 Swamps + 16 Islands is always wrong for a non-budget deck.', 'ratios', 'commander', 'soft', 205, NULL);
