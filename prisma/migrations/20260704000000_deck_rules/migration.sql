CREATE TABLE deck_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_text TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  scope VARCHAR(50) NOT NULL DEFAULT 'all',
  enforcement VARCHAR(10) NOT NULL DEFAULT 'soft',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed from the current rules document
INSERT INTO deck_rules (rule_text, category, scope, enforcement, sort_order) VALUES

-- Commander hard rules
('Deck size is exactly 100 cards including the commander.', 'deck_size', 'commander', 'hard', 10),
('Only 1 legendary creature or planeswalker may serve as commander.', 'general', 'commander', 'hard', 20),
('Singleton: only 1 copy of each card is allowed except basic lands.', 'singleton', 'commander', 'hard', 30),
('All cards must match the commander''s color identity. A card''s color identity includes mana symbols in its mana cost and rules text.', 'color_identity', 'commander', 'hard', 40),
('Colorless cards and basic lands are always legal regardless of commander color identity.', 'color_identity', 'commander', 'hard', 50),
('Starting life total is 40. Typically played with 3–4 players.', 'general', 'commander', 'soft', 60),
('21 points of combat damage from a single commander eliminates that player.', 'general', 'commander', 'soft', 70),
('Each time the commander is recast from the command zone, it costs 2 additional colorless mana (commander tax).', 'general', 'commander', 'soft', 80),

-- Commander ratios (soft)
('Lands: 36–38. Use 38 for high-curve decks; 36 with strong ramp and low average CMC.', 'ratios', 'commander', 'soft', 90),
('Ramp: 10–12 pieces. Sol Ring, mana rocks, Cultivate, Kodama''s Reach, land fetchers all count.', 'ratios', 'commander', 'soft', 100),
('Card draw / advantage: 10–12 pieces. This is the most under-included category — draw wins games.', 'ratios', 'commander', 'soft', 110),
('Removal: 8–12 pieces. Target 7–9 spot removal plus 2–3 board wipes.', 'ratios', 'commander', 'soft', 120),
('Threats / win conditions: 28–34 cards. This is the personality of the deck — creatures, combos, synergy pieces.', 'ratios', 'commander', 'soft', 130),
('Simple starting formula: 36 lands + 10 ramp + 10 draw + 10 removal + 33 threats = 99 cards + commander.', 'ratios', 'commander', 'soft', 140),
('Mana curve peak: 3–4 mana. High-cost spells (6–10 CMC) are acceptable because games go long and ramp is plentiful.', 'mana_curve', 'commander', 'soft', 150),

-- Standard
('Deck size: minimum 60 cards. Exactly 60 is strongly recommended.', 'deck_size', 'standard', 'hard', 200),
('Maximum 4 copies of any card except basic lands.', 'legality', 'standard', 'hard', 210),
('Sideboard: up to 15 cards.', 'general', 'standard', 'hard', 220),
('Card pool: most recent 2–3 years of sets. Rotates each fall when new sets release.', 'legality', 'standard', 'soft', 230),
('Lands: 22–26. Aggro decks run 22–23; control decks run 25–26.', 'ratios', 'standard', 'soft', 240),
('Mana curve peak: 2–4 mana. Cards costing 5+ mana must dominate the board to justify inclusion.', 'mana_curve', 'standard', 'soft', 250),

-- Pioneer
('Deck size: minimum 60 cards.', 'deck_size', 'pioneer', 'hard', 300),
('Maximum 4 copies of any card except basic lands.', 'legality', 'pioneer', 'hard', 310),
('Card pool: Return to Ravnica (October 2012) forward. All 10 original fetch lands are banned.', 'legality', 'pioneer', 'soft', 320),
('Lands: 22–26. Dual lands and mana fixing are available and important.', 'ratios', 'pioneer', 'soft', 330),
('Mana curve peak: 2–3 mana. Format is fast; late-game cards need to end the game when they resolve.', 'mana_curve', 'pioneer', 'soft', 340),

-- Modern
('Deck size: minimum 60 cards.', 'deck_size', 'modern', 'hard', 400),
('Maximum 4 copies of any card except basic lands.', 'legality', 'modern', 'hard', 410),
('Card pool: Eighth Edition (July 2003) forward.', 'legality', 'modern', 'soft', 420),
('Lands: 19–24. Fetch lands plus shock lands enable reliable 3–4 color manabases.', 'ratios', 'modern', 'soft', 430),
('Mana curve peak: 1–3 mana. Every card costing 4+ mana must win the game or generate overwhelming value.', 'mana_curve', 'modern', 'soft', 440),

-- Legacy / Vintage
('Legacy: minimum 60 cards; entire card pool minus banned list. Games can end on turns 1–2.', 'general', 'legacy', 'soft', 500),
('Vintage: maximum 4 of non-restricted cards; restricted cards limited to 1 copy. Power Nine are restricted.', 'general', 'legacy', 'soft', 510),

-- Limited
('Draft / Sealed: minimum 40 cards. Lands are provided by the event.', 'deck_size', 'limited', 'hard', 600),
('Limited: 17 lands is the near-universal standard for 40-card decks.', 'ratios', 'limited', 'soft', 610),
('Limited: 13–16 creatures, 6–9 removal/spells. Removal is premium — include all you can draft.', 'ratios', 'limited', 'soft', 620),
('Limited mana curve peak: 3–4 mana. Limit cards costing 6+ mana to 1–2 unless you have ramp.', 'mana_curve', 'limited', 'soft', 630),

-- Brawl
('Brawl deck size: exactly 60 cards including commander. Standard-legal cards only; rotates with Standard.', 'deck_size', 'brawl', 'hard', 700),
('Brawl: 1 legendary creature or planeswalker as commander. Starting life 25 (1v1) or 30 (multiplayer).', 'general', 'brawl', 'soft', 710),
('Brawl lands: 24–26. Higher than constructed because singleton means less consistency.', 'ratios', 'brawl', 'soft', 720),

-- Collection-only mode
('In collection-only mode, every suggested card must be verified as owned by the player before inclusion.', 'general', 'collection_only', 'hard', 800),
('In collection-only mode, if a role cannot be filled with ideal cards, suggest the next best owned option rather than leaving the slot empty.', 'general', 'collection_only', 'soft', 810);
