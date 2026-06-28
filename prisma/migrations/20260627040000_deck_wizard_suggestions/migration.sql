CREATE TABLE IF NOT EXISTS deck_wizard_suggestions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES deck_wizard_sessions(id) ON DELETE CASCADE,
  scryfall_id TEXT,
  card_name TEXT NOT NULL,
  suggested_role TEXT,
  suggestion_rank INTEGER,
  owned_by_user BOOLEAN DEFAULT false,
  accepted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deck_wizard_suggestions_session ON deck_wizard_suggestions(session_id);
