-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_collection_uploads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "detectedFormat" TEXT,
    "parsedData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_collection_uploads" ("createdAt", "detectedFormat", "id", "parsedData", "rawText", "userId") SELECT "createdAt", "detectedFormat", "id", "parsedData", "rawText", "userId" FROM "collection_uploads";
DROP TABLE "collection_uploads";
ALTER TABLE "new_collection_uploads" RENAME TO "collection_uploads";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
