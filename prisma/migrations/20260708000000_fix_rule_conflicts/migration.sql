-- Fix rule conflicts introduced by layered migrations.
-- Three categories of fixes:
--   1. Wrong scope: Vintage/Pauper/Oathbreaker rules were scoped to 'all' — they fire on every deck.
--   2. Wrong numbers: Migration 3 (format_business_rules) introduced Commander ratios that contradict
--      the community-consensus numbers from migrations 1 and 2.
--   3. Deactivate simple one-liners from migration 1 that are now covered in detail by migration 2/3
--      — reduces prompt noise and eliminates contradictory numbers Khoa has to reconcile.

-- ============================================================
-- FIX 1: Scope corrections
-- ============================================================

-- Vintage rules were scoped to 'all' — they must only apply to Vintage
UPDATE deck_rules SET scope = 'vintage', updated_at = NOW()
WHERE rule_text LIKE 'Vintage deck size%';

UPDATE deck_rules SET scope = 'vintage', updated_at = NOW()
WHERE rule_text LIKE 'Vintage mana curve%';

-- Pauper rules were scoped to 'all'
UPDATE deck_rules SET scope = 'pauper', updated_at = NOW()
WHERE rule_text LIKE 'Pauper deck size%';

UPDATE deck_rules SET scope = 'pauper', updated_at = NOW()
WHERE rule_text LIKE 'Pauper mana curve%';

-- Oathbreaker rules were scoped to 'all'
UPDATE deck_rules SET scope = 'oathbreaker', updated_at = NOW()
WHERE rule_text LIKE 'Oathbreaker deck size%';

UPDATE deck_rules SET scope = 'oathbreaker', updated_at = NOW()
WHERE rule_text LIKE 'Oathbreaker construction%';

UPDATE deck_rules SET scope = 'oathbreaker', updated_at = NOW()
WHERE rule_text LIKE 'Oathbreaker Signature Spell%';

-- ============================================================
-- FIX 2: Correct wrong Commander numbers in migration 3
-- ============================================================

-- Migration 3 said 35–37 lands and 6–10 ramp. Community consensus (migrations 1+2) is 36–38 and 10–12.
UPDATE deck_rules SET
  rule_text = 'Commander mana base target: 36–38 lands for consistent play. Include 8–12 dual/fetch lands for color fixing, 4–6 utility lands for value, and the remainder as basics as search targets. Ramp target: 10–12 pieces (mana rocks, land fetchers, mana dorks).',
  updated_at = NOW()
WHERE rule_text LIKE 'Commander mana base target: 35%';

-- Migration 3 said card draw 4–8 and removal 6–10. Correct values: draw 10–12, removal 8–10 spot + 3–4 wipes.
UPDATE deck_rules SET
  rule_text = 'Commander spell package: 10–12 card draw/advantage sources (repeatable draw beats one-shots); 8–10 spot removal (single-target creatures, artifacts, enchantments); 3–4 board wipes (mass removal at varied mana costs); 8–12 thematic/synergistic spells; 2–4 recursion spells.',
  updated_at = NOW()
WHERE rule_text LIKE 'Commander spell package%';

-- Migration 3 said interaction 8–12. Keep but clarify it covers spot removal only (board wipes are separate).
UPDATE deck_rules SET
  rule_text = 'Commander instant-speed interaction: include 8–10 pieces of instant-speed spot removal or counterspells. Board wipes are counted separately. Include flexible cards that answer multiple threat types.',
  updated_at = NOW()
WHERE rule_text LIKE 'Commander interaction:%';

-- ============================================================
-- FIX 3: Deactivate superseded one-liners from migration 1
-- (these are now covered with correct, detailed numbers in migration 2)
-- ============================================================

-- "Lands: 36–38." — covered by migration 2 and the fixed migration 3 rule above
UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text = 'Lands: 36–38. Use 38 for high-curve decks; 36 with strong ramp and low average CMC.'
  AND scope = 'commander' AND sort_order = 90;

-- "Ramp: 10–12 pieces." — covered by migration 2 and fixed migration 3
UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text LIKE 'Ramp: 10–12 pieces.%'
  AND scope = 'commander' AND sort_order = 100;

-- "Card draw / advantage: 10–12 pieces." — covered by migration 2 and fixed migration 3
UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text LIKE 'Card draw / advantage: 10–12 pieces.%'
  AND scope = 'commander' AND sort_order = 110;

-- "Removal: 8–12 pieces." — covered by migration 2 and fixed migration 3
UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text LIKE 'Removal: 8–12 pieces.%'
  AND scope = 'commander' AND sort_order = 120;

-- "Threats / win conditions: 28–34 cards." — covered by migration 2 blueprint
UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text LIKE 'Threats / win conditions: 28%'
  AND scope = 'commander' AND sort_order = 130;

-- "Simple starting formula: 36 lands + 10 ramp..." — covered by migration 2 blueprint (more detailed)
UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text LIKE 'Simple starting formula%'
  AND scope = 'commander' AND sort_order = 140;

-- Deactivate basic Standard/Pioneer/Modern deck size one-liners from migration 1
-- (migration 3 has full, detailed versions of these rules)
UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text = 'Deck size: minimum 60 cards. Exactly 60 is strongly recommended.'
  AND scope = 'standard' AND sort_order = 200;

UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text = 'Deck size: minimum 60 cards.'
  AND scope = 'pioneer' AND sort_order = 300;

UPDATE deck_rules SET active = false, updated_at = NOW()
WHERE rule_text = 'Deck size: minimum 60 cards.'
  AND scope = 'modern' AND sort_order = 400;

-- ============================================================
-- FIX 4: Align migration 2 blueprint win_conditions range with code (targets 31)
-- Migration 2 said 25–31; migration 1 said 28–34; code targets 31. Unify to 28–32.
-- ============================================================

UPDATE deck_rules SET
  rule_text = 'A balanced Commander deck follows this functional blueprint: 1 commander, 36–38 lands, 10–12 ramp, 10–12 card draw, 8–10 spot removal, 3–4 board wipes, 28–32 synergy/strategy cards. Total: 100 cards.',
  updated_at = NOW()
WHERE rule_text LIKE 'A balanced Commander deck follows this functional blueprint%';
