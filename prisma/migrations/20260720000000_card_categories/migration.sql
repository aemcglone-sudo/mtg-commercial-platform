-- Card category classification cache (rules-based, keyed by card name)
CREATE TABLE IF NOT EXISTS card_categories (
  id                      TEXT PRIMARY KEY,
  "cardName"              TEXT NOT NULL,
  categories              TEXT[] NOT NULL DEFAULT '{}',
  "classificationMethod"  TEXT NOT NULL DEFAULT 'rules',
  "createdAt"             TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS card_categories_card_name_key ON card_categories("cardName");
CREATE INDEX IF NOT EXISTS idx_card_categories_card_name ON card_categories("cardName");
