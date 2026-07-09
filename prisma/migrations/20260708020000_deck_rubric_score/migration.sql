-- Add rubric score storage and commander name to decks table
ALTER TABLE decks ADD COLUMN IF NOT EXISTS commander TEXT;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS rubric_score JSONB;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS rubric_scored_at TIMESTAMPTZ;
