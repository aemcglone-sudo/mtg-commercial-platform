CREATE TABLE IF NOT EXISTS deck_wizard_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  entry_mode TEXT NOT NULL,
  format TEXT NOT NULL,
  commander_scryfall_id TEXT,
  partner_scryfall_id TEXT,
  archetype TEXT,
  themes TEXT[] DEFAULT '{}',
  tribal_type TEXT,
  psychographic TEXT,
  budget_cents INTEGER,
  natural_language_prompt TEXT,
  wizard_state JSONB DEFAULT '{}',
  current_step INTEGER DEFAULT 1,
  result_deck_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deck_wizard_sessions_user_id ON deck_wizard_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_deck_wizard_sessions_status ON deck_wizard_sessions(status);
