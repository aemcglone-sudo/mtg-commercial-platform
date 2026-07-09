-- MTG Format Business Rules — comprehensive deck construction guidelines for all formats

-- ============================================================
-- GENERAL RULES (all formats)
-- ============================================================
INSERT INTO deck_rules (rule_text, category, scope, enforcement, sort_order, notes) VALUES

('Mana curve: aggressive decks peak at 2–3 CMC; midrange at 3–4 CMC; control at 4–5 CMC; ramp at 6–8 CMC; combo at 2–3 CMC for fast setup.', 'mana_curve', 'all', 'soft', 1000, NULL),

('Card evaluation priority order: (1) power level — does it win games? (2) synergy — does it work with the deck? (3) role — does it fill a needed slot? (4) redundancy — are similar effects already present? (5) mana efficiency — good cost-to-effect ratio? (6) flexibility — can it be used multiple ways?', 'general', 'all', 'soft', 1010, NULL),

('Removal suite balance across all formats: ~40% creature removal (targeted), ~40% board wipes (sweepers), ~20% other (planeswalker, artifact, enchantment removal).', 'ratios', 'all', 'soft', 1020, NULL),

('Card advantage sources: creatures with draw triggers (ETB, attack), cantrips and draw spells, tutors, recursion, and token generation all count as card advantage.', 'ratios', 'all', 'soft', 1030, NULL),

('Land counts by deck size: 60-card decks use 23–27 lands (average 24); 100-card decks use 35–40 lands (average 37); 40-card limited decks use 16–18 lands (average 17).', 'ratios', 'all', 'soft', 1040, NULL),

('Color distribution for lands: mono-color 20–24 of that color; 2-color 10–12 of each; 3-color 7–9 of each; 4-color 6–7 of each; 5-color 4–5 of each with heavy mana base support.', 'ratios', 'all', 'soft', 1050, NULL),

('Include dual lands whenever the deck uses more than 10% colored mana symbols of a given color. Never skip mana fixing in multicolor decks.', 'ratios', 'all', 'soft', 1060, NULL),

-- ============================================================
-- STANDARD
-- ============================================================
('Standard deck size: 60 cards minimum (typically exactly 60). Up to 4 copies of each card; unlimited basic lands. Only sets from the past ~2 years (rotates annually).', 'deck_size', 'standard', 'hard', 2000, NULL),

('Standard mana curve peaks at 3–4 CMC for midrange, 2–3 for aggressive decks. Include 24–26 lands; reduce land count as average CMC decreases.', 'mana_curve', 'standard', 'soft', 2010, NULL),

('Standard creature counts by archetype: aggressive 12–14 creatures minimum; midrange 8–12; control 4–8. Every card must fill a specific role — no filler.', 'ratios', 'standard', 'soft', 2020, NULL),

('Standard removal suite: 8–12 total spells (targeted removal + board wipes). Card draw/filtering: 4–8 spells or creatures with draw triggers.', 'ratios', 'standard', 'soft', 2030, NULL),

('Standard mana base: highly optimized due to limited dual land availability. Include 2–4 playsets of key enablers and payoffs. Build sideboard of 15 cards with meta-specific tech.', 'ratios', 'standard', 'soft', 2040, NULL),

('Standard card selection: choose cards legal in current rotation only. Build around recent mechanics and tribal themes. Prioritize cards that synergize with current set mechanics.', 'legality', 'standard', 'hard', 2050, NULL),

-- ============================================================
-- PIONEER
-- ============================================================
('Pioneer deck size: 60 cards minimum. Up to 4 copies of each card; unlimited basic lands. Legal cards: Return to Ravnica forward plus all subsequent sets.', 'deck_size', 'pioneer', 'hard', 3000, NULL),

('Pioneer mana curve peaks at 3–4 CMC with more flexibility than Standard. Use 23–25 lands. Graveyard interaction is stronger than Standard — leverage it.', 'mana_curve', 'pioneer', 'soft', 3010, NULL),

('Pioneer creature counts: 12–16 creatures (larger pool available). Removal: 8–12 spells. Card advantage: 4–8 spells or creatures. Include 2–4 of similar effects for redundancy and consistency.', 'ratios', 'pioneer', 'soft', 3020, NULL),

('Pioneer rewards synergistic deck building. Graveyard decks, tribal themes, and sacrifice synergies are all viable and well-supported. Playsets of key cards are powerful — build around them.', 'general', 'pioneer', 'soft', 3030, NULL),

-- ============================================================
-- MODERN
-- ============================================================
('Modern deck size: 60 cards minimum. Up to 4 copies of each card; unlimited basic lands. Legal cards: Eighth Edition (2003) forward.', 'deck_size', 'modern', 'hard', 4000, NULL),

('Modern mana curve is dominated by 0–3 CMC cards (tempo and combo focus). Use 23–25 lands. Fetchlands and shock lands are essential for consistent mana in multicolor builds.', 'mana_curve', 'modern', 'soft', 4010, NULL),

('Modern creature counts: 12–20 (creature-heavy strategies are viable). Interaction: 8–16 spells (removal and disruption). Card advantage: 4–8 sources. Combo enablers: 4–8 cards if combo-focused.', 'ratios', 'modern', 'soft', 4020, NULL),

('Modern rewards tight synergies. Playsets are crucial for consistency. Graveyard synergies and artifact synergies are particularly strong. Broken mechanics, efficient tutors, and card draw engines define top decks.', 'general', 'modern', 'soft', 4030, NULL),

-- ============================================================
-- LEGACY
-- ============================================================
('Legacy deck size: 60 cards minimum. Up to 4 copies of each card (with restricted list); unlimited basic lands. Legal: all cards ever printed except the banned list.', 'deck_size', 'legacy', 'hard', 5000, NULL),

('Legacy mana curve is heavily weighted toward 0–2 CMC — cantrips, efficient creatures, and free spells dominate. Use 20–23 lands (extremely tuned); fetchlands are essential.', 'mana_curve', 'legacy', 'soft', 5010, NULL),

('Legacy creature counts: 8–16 (utility creatures and efficient beaters). Interaction: 16–24 spells (counter/removal-heavy). Card draw: 6–12 cantrips. Tutors: up to 8 if legal.', 'ratios', 'legacy', 'soft', 5020, NULL),

('Legacy has access to broken mana (Black Lotus, Moxes), powerful tutors (Demonic Tutor), and the most efficient threats in Magic history. Combo and control are dominant archetypes. Consistency through tutors and redundancy is paramount.', 'general', 'legacy', 'soft', 5030, NULL),

-- ============================================================
-- VINTAGE
-- ============================================================
('Vintage deck size: 60 cards minimum. Restricted list cards: maximum 1 copy. All other cards: up to 4 copies. Legal: all cards ever printed except the banned list.', 'deck_size', 'all', 'hard', 5500, 'Applies to Vintage format only'),

('Vintage mana curve is weighted toward 0–1 CMC — the most broken cards in Magic cost 0 or 1. Use 18–20 lands. Restricted cards like Black Lotus, Ancestral Recall, and Time Walk should be included as strategic 1-ofs.', 'mana_curve', 'all', 'soft', 5510, 'Vintage format only'),

-- ============================================================
-- PAUPER
-- ============================================================
('Pauper deck size: 60 cards minimum. Up to 4 copies of each card; unlimited basic lands. Only commons from any set are legal — rarity is determined by any printing at common.', 'deck_size', 'all', 'hard', 6000, 'Pauper format only'),

('Pauper mana curve peaks at 1–3 CMC (commons are weak at high casting costs). Use 24–26 lands (limited dual lands at common). Creatures: 16–24 (creature-heavy format). Removal: 4–8 spells. Tribal, sacrifice, and tempo archetypes work well.', 'mana_curve', 'all', 'soft', 6010, 'Pauper format only'),

-- ============================================================
-- LIMITED (DRAFT / SEALED)
-- ============================================================
('Limited deck size: 40 cards minimum. Use 16–18 lands (draft), 17–19 lands (sealed). Play primarily 2 colors with optional 1-color splash. Creatures make up the majority of the deck.', 'deck_size', 'limited', 'hard', 7000, NULL),

('Draft mana curve targets: 2–4 one-drops, 4–6 two-drops, 4–6 three-drops, 4–5 four-drops, 2–4 five-drops, 1–2 six-plus drops. Quality creatures over quantity. Include 2–4 evasive creatures.', 'mana_curve', 'limited', 'soft', 7010, NULL),

('Draft creature counts: 20–24 creatures out of 40 cards. Spells: 4–6 (2–4 removal/interaction, 2–3 combat tricks). Synergy beats raw power in draft — pick cards that work together.', 'ratios', 'limited', 'soft', 7020, NULL),

('Draft color balance: 60% of creatures in primary color, 30% in secondary, 10% splash. Follow signals (cards being passed) to identify open colors. Stay open through pack 1, commit by pack 2 pick 1.', 'ratios', 'limited', 'soft', 7030, NULL),

('Sealed construction: include all playable creatures in your two best colors. Removal is scarcer — prioritize every removal spell available. Mana base is more critical than in draft due to inconsistent pools.', 'ratios', 'limited', 'soft', 7040, NULL),

-- ============================================================
-- COMMANDER (EDH)
-- ============================================================
('Commander mana base target: 35–37 lands minimum for consistent play. Include 8–12 dual/fetch lands for color fixing, 4–6 utility lands for value, and 15–20 basics as search targets. Mana rocks: 6–10 pieces of ramp.', 'ratios', 'commander', 'soft', 8000, NULL),

('Commander creature counts by archetype: Aggro/Tribal 28–35 creatures; Midrange 20 creatures; Control 6–8 creatures; Combo 4–8 creatures; Ramp/Big 12–18 creatures.', 'ratios', 'commander', 'soft', 8010, NULL),

('Commander spell package: 4–8 card draw/tutors; 6–10 removal (single-target plus board wipes); 4–6 ramp/acceleration; 8–12 thematic/synergistic spells; 2–4 recursion spells.', 'ratios', 'commander', 'soft', 8020, NULL),

('Commander interaction: include 8–12 pieces of instant-speed interaction (responses to opponent plays). Include flexible cards that serve multiple roles. Include "silver bullets" that answer common threats.', 'ratios', 'commander', 'soft', 8030, NULL),

('Commander synergy density target: 60–70% of cards should synergize with the commander or theme. 10–15% flexibility/utility slots. 15–25% ramp/mana/lands.', 'ratios', 'commander', 'soft', 8040, NULL),

('Commander multiplayer considerations: include draw sources (you only draw one per rotation), politics cards that create decisions, and don''t overextend early (you will be targeted). Tutors are more valuable in Commander than 1v1 — they find specific answers.', 'general', 'commander', 'soft', 8050, NULL),

-- ============================================================
-- BRAWL
-- ============================================================
('Brawl deck size: 60 cards including the commander. 1 of each card except basic lands. Commander must be a legendary creature. Legal cards match current Standard or Pioneer depending on variant.', 'deck_size', 'brawl', 'hard', 9000, NULL),

('Brawl mana base: 22–24 total lands. Include 6–10 dual lands (essential in 60-card singleton for color consistency). Remaining slots are basic lands.', 'ratios', 'brawl', 'soft', 9010, NULL),

('Brawl spell counts: 3–6 removal spells, 2–4 board wipes, 3–6 card draw, 6–10 synergistic spells, 2–4 ramp/mana acceleration. Creatures: 14–18, focused on commander synergy.', 'ratios', 'brawl', 'soft', 9020, NULL),

('Brawl mana curve peaks at 3–4 CMC. Maximum CMC usually 6–7. Keep 35–40% of the deck at 1–2 CMC for early game density. Include backup plans if commander is repeatedly answered.', 'mana_curve', 'brawl', 'soft', 9030, NULL),

-- ============================================================
-- OATHBREAKER
-- ============================================================
('Oathbreaker deck size: 60 cards including the Oathbreaker (legendary planeswalker) and one Signature Spell (instant or sorcery that starts in the Command Zone). Color identity rule applies — all cards must match Oathbreaker color identity.', 'deck_size', 'all', 'hard', 9500, 'Oathbreaker format only'),

('Oathbreaker construction: 22–24 lands (6–10 duals, 12–16 basics), 12–16 creatures synergistic with the planeswalker, 22–26 spells including 3–6 tutors/draw to find the Signature Spell, 4–8 removal spells, and planeswalker protection effects.', 'ratios', 'all', 'soft', 9510, 'Oathbreaker format only'),

('Oathbreaker Signature Spell should: synergize with the Oathbreaker''s plus or minus abilities, provide repeatable value when cast multiple times from the Command Zone, and directly advance the deck''s win condition.', 'general', 'all', 'soft', 9520, 'Oathbreaker format only');

-- Color identity enforcement rule
INSERT INTO deck_rules (rule_text, category, scope, enforcement, sort_order, notes) VALUES
('Commander color identity is a hard rule: every card in the deck (including lands) must use only mana symbols that appear in the commander''s color identity. A commander with a Boros (white/red) identity cannot include blue, green, or black cards — not even colorless cards with off-color activated abilities. Lands like Tropical Island or Breeding Pool are illegal in a mono-red deck.', 'legality', 'commander', 'hard', 195, 'Enforced by Scryfall color identity check post-suggestion.');
