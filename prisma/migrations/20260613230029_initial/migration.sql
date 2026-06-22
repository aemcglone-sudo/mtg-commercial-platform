-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "appleId" TEXT,
    "avatarUrl" TEXT,
    "magicPreferencesJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "detectedFormat" TEXT,
    "parsedData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "collectionType" TEXT,
    "statusLocation" TEXT NOT NULL DEFAULT 'storage',
    "brandSet" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "primaryImageUrl" TEXT,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "isAutograph" BOOLEAN NOT NULL DEFAULT false,
    "isRookie" BOOLEAN NOT NULL DEFAULT false,
    "gradingCompany" TEXT,
    "gradeScore" DOUBLE PRECISION,
    "productLine" TEXT,
    "packaging" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT,
    "strategy" TEXT,
    "cards" TEXT,
    "personaType" TEXT,
    "coreGoal" TEXT,
    "lastAnalyzed" TIMESTAMP(3),
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck_items" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "deck_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_location_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_location_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_prices" (
    "id" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardSetCode" TEXT,
    "priceUsd" DOUBLE PRECISION,
    "priceFoilUsd" DOUBLE PRECISION,
    "priceEur" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'scryfall',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardSetCode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'scryfall',
    "priceUsd" DOUBLE PRECISION,
    "priceFoilUsd" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_stats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalValueUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valueChange7d" DOUBLE PRECISION,
    "uniqueCardCount" INTEGER NOT NULL DEFAULT 0,
    "totalCardCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "previousPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "changePercent" DOUBLE PRECISION NOT NULL,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "khoa_chats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "messages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "khoa_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck_analysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avgManaCost" DOUBLE PRECISION,
    "colorIdentity" TEXT,
    "creatureCount" INTEGER,
    "spellCount" INTEGER,
    "landCount" INTEGER,
    "synergiesDetected" TEXT,
    "metaScore" DOUBLE PRECISION,
    "tourneyAppearances" INTEGER,
    "successRate" DOUBLE PRECISION,
    "playedDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "deck_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_synergies" (
    "id" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "synergyPartner" TEXT NOT NULL,
    "synergyType" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "card_synergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoriteFormats" TEXT,
    "playStyle" TEXT,
    "budgetRange" TEXT,
    "collectorOrPlayer" TEXT,
    "acceptanceRate" DOUBLE PRECISION,
    "averageDeckTurnaround" TEXT,
    "colorPreferences" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT,
    "cardName" TEXT,
    "suggestionType" TEXT NOT NULL,
    "reason" TEXT,
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adopted" BOOLEAN,
    "adoptedAt" TIMESTAMP(3),
    "userFeedback" TEXT,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banned_list_snapshots" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "bannedCards" TEXT,
    "restrictedCards" TEXT,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_list_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "formats" TEXT,
    "eventTypes" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "userRating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_venues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_appleId_key" ON "users"("appleId");

-- CreateIndex
CREATE UNIQUE INDEX "deck_items_deckId_itemId_key" ON "deck_items"("deckId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "user_location_preferences_userId_key" ON "user_location_preferences"("userId");

-- CreateIndex
CREATE INDEX "card_prices_cardName_idx" ON "card_prices"("cardName");

-- CreateIndex
CREATE INDEX "card_prices_lastUpdated_idx" ON "card_prices"("lastUpdated");

-- CreateIndex
CREATE UNIQUE INDEX "card_prices_cardName_cardSetCode_source_key" ON "card_prices"("cardName", "cardSetCode", "source");

-- CreateIndex
CREATE INDEX "price_history_cardName_capturedAt_idx" ON "price_history"("cardName", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "price_history_cardName_source_capturedAt_key" ON "price_history"("cardName", "source", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "collection_stats_userId_key" ON "collection_stats"("userId");

-- CreateIndex
CREATE INDEX "price_alerts_userId_idx" ON "price_alerts"("userId");

-- CreateIndex
CREATE INDEX "khoa_chats_userId_idx" ON "khoa_chats"("userId");

-- CreateIndex
CREATE INDEX "deck_analysis_userId_analyzedAt_idx" ON "deck_analysis"("userId", "analyzedAt" DESC);

-- CreateIndex
CREATE INDEX "card_synergies_cardName_idx" ON "card_synergies"("cardName");

-- CreateIndex
CREATE INDEX "card_synergies_synergyPartner_idx" ON "card_synergies"("synergyPartner");

-- CreateIndex
CREATE UNIQUE INDEX "card_synergies_cardName_synergyPartner_key" ON "card_synergies"("cardName", "synergyPartner");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "suggestions_userId_suggestedAt_idx" ON "suggestions"("userId", "suggestedAt" DESC);

-- CreateIndex
CREATE INDEX "suggestions_userId_adopted_idx" ON "suggestions"("userId", "adopted");

-- CreateIndex
CREATE INDEX "banned_list_snapshots_format_snapshotDate_idx" ON "banned_list_snapshots"("format", "snapshotDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "banned_list_snapshots_format_snapshotDate_key" ON "banned_list_snapshots"("format", "snapshotDate");

-- CreateIndex
CREATE INDEX "community_venues_city_state_idx" ON "community_venues"("city", "state");

-- AddForeignKey
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_analysis" ADD CONSTRAINT "deck_analysis_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
