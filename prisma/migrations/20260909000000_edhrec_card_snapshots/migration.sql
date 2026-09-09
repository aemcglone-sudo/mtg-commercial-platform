CREATE TABLE IF NOT EXISTS "edhrec_card_snapshots" (
  "id" TEXT PRIMARY KEY,
  "commander_slug" TEXT NOT NULL,
  "commander_name" TEXT NOT NULL,
  "card_name" TEXT NOT NULL,
  "num_decks" INTEGER NOT NULL,
  "potential_decks" INTEGER NOT NULL,
  "inclusion_rate" DOUBLE PRECISION NOT NULL,
  "snapshot_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE ("commander_slug", "card_name", "snapshot_date")
);
CREATE INDEX IF NOT EXISTS "edhrec_card_snapshots_card_name_snapshot_date_idx" ON "edhrec_card_snapshots" ("card_name", "snapshot_date");
CREATE INDEX IF NOT EXISTS "edhrec_card_snapshots_commander_slug_snapshot_date_idx" ON "edhrec_card_snapshots" ("commander_slug", "snapshot_date");
