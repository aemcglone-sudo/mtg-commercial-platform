-- CreateTable price_history
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "priceUsd" REAL,
    "priceFoilUsd" REAL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "price_history_cardName_source_capturedAt_key" ON "price_history"("cardName", "source", "capturedAt");
CREATE INDEX "price_history_cardName_capturedAt_idx" ON "price_history"("cardName", "capturedAt" DESC);

-- CreateTable deck_analysis
CREATE TABLE "deck_analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avgManaCost" REAL,
    "colorIdentity" TEXT,
    "creatureCount" INTEGER,
    "spellCount" INTEGER,
    "landCount" INTEGER,
    "synergiesDetected" TEXT,
    "metaScore" REAL,
    "tourneyAppearances" INTEGER,
    "successRate" REAL,
    "playedDate" DATETIME,
    "notes" TEXT,
    CONSTRAINT "deck_analysis_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "deck_analysis_userId_analyzedAt_idx" ON "deck_analysis"("userId", "analyzedAt" DESC);

-- CreateTable card_synergies
CREATE TABLE "card_synergies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardName" TEXT NOT NULL,
    "synergyPartner" TEXT NOT NULL,
    "synergyType" TEXT NOT NULL,
    "strength" REAL NOT NULL,
    "note" TEXT
);

CREATE UNIQUE INDEX "card_synergies_cardName_synergyPartner_key" ON "card_synergies"("cardName", "synergyPartner");
CREATE INDEX "card_synergies_cardName_idx" ON "card_synergies"("cardName");
CREATE INDEX "card_synergies_synergyPartner_idx" ON "card_synergies"("synergyPartner");

-- CreateTable user_preferences
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "favoriteFormats" TEXT,
    "playStyle" TEXT,
    "budgetRange" TEXT,
    "collectorOrPlayer" TEXT,
    "acceptanceRate" REAL,
    "averageDeckTurnaround" TEXT,
    "colorPreferences" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable suggestions
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deckId" TEXT,
    "cardName" TEXT,
    "suggestionType" TEXT NOT NULL,
    "reason" TEXT,
    "suggestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adopted" BOOLEAN,
    "adoptedAt" DATETIME,
    "userFeedback" TEXT,
    CONSTRAINT "suggestions_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "suggestions_userId_suggestedAt_idx" ON "suggestions"("userId", "suggestedAt" DESC);
CREATE INDEX "suggestions_userId_adopted_idx" ON "suggestions"("userId", "adopted");

-- CreateTable banned_list_snapshots
CREATE TABLE "banned_list_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "format" TEXT NOT NULL,
    "bannedCards" TEXT,
    "restrictedCards" TEXT,
    "snapshotDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "banned_list_snapshots_format_snapshotDate_key" ON "banned_list_snapshots"("format", "snapshotDate");
CREATE INDEX "banned_list_snapshots_format_snapshotDate_idx" ON "banned_list_snapshots"("format", "snapshotDate" DESC);

-- CreateTable community_venues
CREATE TABLE "community_venues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "formats" TEXT,
    "eventTypes" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "verifiedAt" DATETIME,
    "userRating" REAL,
    "reviewCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "community_venues_city_state_idx" ON "community_venues"("city", "state");

-- Modify users table: add magicPreferencesJson field
ALTER TABLE "users" ADD COLUMN "magicPreferencesJson" TEXT;

-- Modify decks table: add win rate tracking
ALTER TABLE "decks" ADD COLUMN "gamesPlayed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "decks" ADD COLUMN "gamesWon" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "decks" ADD COLUMN "lastPlayedDate" DATETIME;
