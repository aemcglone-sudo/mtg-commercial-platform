-- Commander functional blueprint rules — authoritative deck building guidance for Khoa
-- These supplement the format rules already seeded in 20260704000000_deck_rules

INSERT INTO deck_rules (rule_text, category, scope, enforcement, sort_order, notes) VALUES

-- Functional blueprint targets
('A balanced Commander deck follows this functional blueprint: 1 commander, 36–38 lands, 10–12 ramp, 10+ card draw, 8–10 spot removal, 3–4 board wipes, 25–31 synergy/strategy cards. Total: 100 cards.', 'ratios', 'commander', 'soft', 200, 'The community baseline. Adjust for specific archetypes.'),

('Ramp comes from mana rocks (Sol Ring, Arcane Signet, signets, talismans), land-fetch sorceries (Cultivate, Kodama''s Reach, Farseek), and mana dorks (Birds of Paradise, Llanowar Elves). Match the archetype — artifact strategies prefer rocks, green decks prefer land ramp.', 'ratios', 'commander', 'soft', 210, NULL),

('Card draw includes engines (Rhystic Study, Sylvan Library, Phyrexian Arena), creature-based draw (Beast Whisperer, Edric), and spells (Night''s Whisper, Brainstorm, Painful Truths). Prioritize repeatable sources over one-shot draw.', 'ratios', 'commander', 'soft', 220, 'Card draw is chronically underplayed — 10 sources minimum.'),

('Spot removal handles single threats: creature exile (Swords to Plowshares, Path to Exile), artifact/enchantment removal (Disenchant, Beast Within, Generous Gift), and counterspells in blue. Target 8–10 pieces.', 'ratios', 'commander', 'soft', 230, NULL),

('Board wipes are separate from spot removal. Every Commander deck needs 3–4 mass removal spells as emergency resets: Wrath of God, Blasphemous Act, Cyclonic Rift, Farewell, Toxic Deluge, Damnation, Supreme Verdict. Vary mana costs so you have options at different points.', 'ratios', 'commander', 'soft', 240, 'Board wipes win games — never skip them.'),

-- Archetype distributions
('Creature-heavy decks (Aggro, Tribal, Aristocrats): 28–35 creatures, 36–38 lands, 10–12 artifacts/enchantments, 15–20 instants/sorceries.', 'ratios', 'commander', 'soft', 250, 'Tribal and go-wide strategies need critical mass of creatures.'),

('Spellslinger decks (Storm, Control, Burn): 6–12 creatures, 36–38 lands, 6–10 artifacts/enchantments, 40+ instants/sorceries.', 'ratios', 'commander', 'soft', 260, NULL),

('Artifact/Enchantment-focused decks (Cheerios, Enchantress): 12–18 creatures, 36 lands, 25–35 artifacts or enchantments, 12–15 instants/sorceries.', 'ratios', 'commander', 'soft', 270, NULL),

-- Land quality rules
('Lands must serve double duty wherever possible. Prioritize: Command Tower (always include), Exotic Orchard, Mana Confluence, City of Brass for multicolor fixing; utility lands that synergize with the deck strategy; shock lands, check lands, and pain lands for color fixing.', 'ratios', 'commander', 'soft', 280, NULL),

('Never suggest basic lands as part of the utility land package — basics are added automatically by the deck builder to fill remaining slots. Every land suggestion should be a named non-basic that provides fixing or utility above a basic.', 'general', 'commander', 'hard', 290, 'Basics are auto-filled. Named lands only.'),

('Cycle lands (Irrigated Farmland, Fetid Pools, etc.) are excellent in Commander — they fix colors early and cycle late. Include 2–4 in most multicolor decks.', 'ratios', 'commander', 'soft', 300, NULL),

-- Collection-only addendum
('In collection-only mode: if the ideal card for a role is not in the collection, choose the next-best card the user owns rather than leaving the slot empty. A functional deck with suboptimal cards beats an incomplete deck.', 'general', 'collection_only', 'soft', 310, NULL);
