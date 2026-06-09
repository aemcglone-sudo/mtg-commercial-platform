-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_decks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT,
    "strategy" TEXT,
    "cards" TEXT,
    "personaType" TEXT,
    "coreGoal" TEXT,
    "lastAnalyzed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_decks" ("cards", "coreGoal", "createdAt", "format", "id", "lastAnalyzed", "name", "personaType", "strategy", "updatedAt", "userId") SELECT "cards", "coreGoal", "createdAt", "format", "id", "lastAnalyzed", "name", "personaType", "strategy", "updatedAt", "userId" FROM "decks";
DROP TABLE "decks";
ALTER TABLE "new_decks" RENAME TO "decks";
CREATE TABLE "new_inventory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "statusLocation" TEXT NOT NULL DEFAULT 'storage',
    "brandSet" TEXT,
    "estimatedValue" REAL,
    "primaryImageUrl" TEXT,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "isAutograph" BOOLEAN NOT NULL DEFAULT false,
    "isRookie" BOOLEAN NOT NULL DEFAULT false,
    "gradingCompany" TEXT,
    "gradeScore" REAL,
    "productLine" TEXT,
    "packaging" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_inventory_items" ("brandSet", "createdAt", "estimatedValue", "gradeScore", "gradingCompany", "id", "isAutograph", "isBase", "isParallel", "isRookie", "itemType", "name", "notes", "packaging", "primaryImageUrl", "productLine", "quantity", "statusLocation", "updatedAt", "userId") SELECT "brandSet", "createdAt", "estimatedValue", "gradeScore", "gradingCompany", "id", "isAutograph", "isBase", "isParallel", "isRookie", "itemType", "name", "notes", "packaging", "primaryImageUrl", "productLine", "quantity", "statusLocation", "updatedAt", "userId" FROM "inventory_items";
DROP TABLE "inventory_items";
ALTER TABLE "new_inventory_items" RENAME TO "inventory_items";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
