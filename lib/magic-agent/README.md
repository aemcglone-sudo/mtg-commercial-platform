# Magic Agent System - Week 1 Infrastructure

## Overview

Week 1 has successfully established the complete foundation for the specialized Magic agent system. All database tables are created, TypeScript types are defined, and the job runner framework is ready for agent modules.

## What Was Created

### 1. Database Migration ✅
**File**: `prisma/migrations/20260606113557_add_magic_agent_tables/migration.sql`

7 new tables created:
- **price_history** - Tracks card prices over time for trend analysis
- **deck_analysis** - Stores analytical data about user decks
- **card_synergies** - Pre-computed synergy relationships between cards
- **user_preferences** - User's Magic preferences and play style
- **suggestions** - History of recommendations made to users
- **banned_list_snapshots** - Historical records of banned/restricted cards per format
- **community_venues** - MTG play locations (stores, clubs, tournaments)

Plus 2 table modifications:
- **users**: Added `magicPreferencesJson` field
- **decks**: Added game tracking fields (`gamesPlayed`, `gamesWon`, `lastPlayedDate`)

**Status**: ✅ Applied successfully to dev.db

### 2. Type Definitions ✅
**File**: `lib/magic-agent/types.ts`

Comprehensive TypeScript interfaces for:
- **Database entities**: All 7 new tables as typed interfaces
- **API responses**: Meta data, validation results, suggestions, etc.
- **Internal types**: Trends, analysis, recommendations
- **Job context**: Background job tracking and results

**Usage**:
```typescript
import { 
  PriceHistory, 
  DeckAnalysis, 
  Suggestion,
  MetaData,
  Recommendation 
} from '@/lib/magic-agent';
```

### 3. Job Runner Framework ✅
**File**: `lib/magic-agent/job-runner.ts`

Serverless-friendly background job system featuring:

#### Core Functions
- `executeJobAsync()` - Fire off async job without blocking response
- `getDataWithAutoRefresh()` - Smart caching that triggers background refresh if stale
- `isDataStale()` - Check if cached data needs refresh
- `getCachedData()` / `setCachedData()` - In-memory cache management

#### Rate Limiting
- `rateLimiter` - Prevent concurrent job execution
- `JOB_THRESHOLDS` - Age thresholds (2h price, 6h meta, 24h bans)

#### Utilities
- `processBatch()` - Process items in batches with progress tracking
- `clearStaleCache()` - Clean old cache entries
- `getCacheStats()` - Debug cache state

**Design**: Lazy on-demand (no external cron) - jobs trigger when users access data, cache results for next request.

**Example**:
```typescript
// In API route - return immediately, refresh in background if stale
const prices = await getDataWithAutoRefresh(
  'user-prices-' + userId,
  JOB_THRESHOLDS.PRICE_UPDATE,
  () => getPricesFromDatabase(userId),
  () => updatePricesInBackground(userId)
);
```

### 4. Database Query Helpers ✅
**File**: `lib/magic-agent/db-queries.ts`

Type-safe functions for all agent tables:

#### Price History
- `recordPriceSnapshot()` - Store a price for a card
- `getPriceHistory()` - Retrieve price history (last N days)
- `getLatestPrice()` - Get most recent price

#### Deck Analysis
- `saveDeckAnalysis()` - Store deck analysis results
- `getDeckAnalysis()` - Retrieve analysis for a deck
- `getUserDeckAnalyses()` - Get all analyses for a user

#### Card Synergies
- `getCardSynergies()` - Get synergies for a card
- `addCardSynergy()` - Add synergy (from EDHREC, tournaments)
- `findDeckSynergies()` - Find mutual synergies in a deck

#### User Preferences
- `getUserPreferences()` - Get user's preferences
- `updateUserPreferences()` - Update preferences
- `getSuggestionAdoptionRate()` - Track how often user adopts suggestions

#### Suggestions
- `recordSuggestion()` - Save a suggestion
- `markSuggestionAdopted()` - Mark suggestion as used
- `getUserSuggestions()` - Get suggestion history

#### Banned Lists
- `getBannedList()` - Get current bans for format
- `updateBannedList()` - Update ban list
- `isCardBanned()` - Check if card is banned

#### Community Venues
- `findNearbyVenues()` - Find venues by coordinates
- `findVenuesInCity()` - Find venues in a city
- `findVenuesByFormat()` - Find venues supporting a format
- `upsertVenue()` - Add or update a venue

**Usage**:
```typescript
import { recordPriceSnapshot, getPriceHistory } from '@/lib/magic-agent';

// Store a price
await recordPriceSnapshot('Brainstorm', 'scryfall', 15.99, 25.50);

// Retrieve price trend
const history = await getPriceHistory('Brainstorm', 30);
```

### 5. Index File ✅
**File**: `lib/magic-agent/index.ts`

Central export point - import from `@/lib/magic-agent` to get all types and utilities.

## Database Structure

### Quick Reference

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| price_history | Price tracking | cardName, source, priceUsd, capturedAt |
| deck_analysis | Deck insights | userId, deckId, metaScore, synergiesDetected |
| card_synergies | Card relationships | cardName, synergyPartner, strength |
| user_preferences | User profile | userId, playStyle, budgetRange, favoriteFormats |
| suggestions | Recommendations | userId, suggestionType, adopted |
| banned_list_snapshots | Format history | format, bannedCards, snapshotDate |
| community_venues | Play locations | name, city, formats, userRating |

### Foreign Keys & Constraints
- `deck_analysis.deckId` → `decks.id` (CASCADE delete)
- `suggestions.deckId` → `decks.id` (SET NULL on delete)
- `user_preferences.userId` → `users.id` (CASCADE delete)
- Unique indices for efficient lookups

## Architecture Decisions Made

### 1. Lazy On-Demand Jobs
✅ **No external cron** - serverless-friendly  
✅ **Smart caching** - return stale data immediately, refresh in background  
✅ **Auto-scaling** - more users = more refreshes (no bottleneck)

### 2. JSON Storage for Complex Data
✅ Uses JSON strings for: synergies, color preferences, card lists  
✅ Parsed to proper types at query time  
✅ Follows existing pattern (decks.cards, collection_uploads.parsedData)

### 3. Centralized Type System
✅ Single source of truth for all types  
✅ Ensures consistency across modules  
✅ Makes IDE autocomplete reliable

## How to Use Week 1 Infrastructure

### In API Routes

```typescript
import { 
  getDataWithAutoRefresh, 
  JOB_THRESHOLDS,
  recordPriceSnapshot,
  getDeckAnalysis 
} from '@/lib/magic-agent';

export async function GET(req: NextRequest) {
  const userId = session.user.id;
  
  // Example 1: Get cached data with auto-refresh
  const priceData = await getDataWithAutoRefresh(
    `prices-${userId}`,
    JOB_THRESHOLDS.PRICE_UPDATE,
    async () => {
      // Fetch from DB if no cache
      const rows = await findMany(...);
      return rows;
    },
    async () => {
      // Background refresh if stale
      return { itemsProcessed: 100 };
    }
  );

  // Example 2: Record data
  await recordPriceSnapshot('Sol Ring', 'scryfall', 12.50, null);

  // Example 3: Retrieve analysis
  const analysis = await getDeckAnalysis(deckId);
  
  return NextResponse.json({ priceData, analysis });
}
```

### In Agent Modules (Week 2+)

```typescript
import { 
  recordSuggestion,
  saveDeckAnalysis,
  getCardSynergies,
  type Suggestion,
  type Recommendation 
} from '@/lib/magic-agent';

async function optimizeDeck(userId: string, deckId: string) {
  // Get synergies
  const synergies = await getCardSynergies('Sol Ring');
  
  // Save analysis
  await saveDeckAnalysis(userId, deckId, {
    avgManaCost: 2.5,
    metaScore: 78,
    synergiesDetected: [
      { name: 'Ramp Engine', cards: ['Sol Ring', 'Mana Crypt'], strength: 'strong' }
    ]
  });
  
  // Record suggestion
  const suggestionId = await recordSuggestion(
    userId,
    'deck_improvement',
    'Add Mana Crypt for better ramp',
    deckId,
    'Mana Crypt'
  );

  return { suggestionId };
}
```

## Testing the Week 1 Setup

### 1. Verify Tables
```bash
sqlite3 dev.db ".tables"
# Should show: price_history, deck_analysis, card_synergies, etc.
```

### 2. Check Schema
```bash
sqlite3 dev.db ".schema price_history"
# Verify columns and indices
```

### 3. Run Type Check
```bash
npx tsc --noEmit
# Should pass with no errors
```

### 4. Test Import
```typescript
import { recordPriceSnapshot, type PriceHistory } from '@/lib/magic-agent';
// Should autocomplete correctly in IDE
```

## What's Next (Week 2)

The following agent modules will be built:
1. **Meta Analyzer** - Fetch tournament data, score decks
2. **Price Tracker** - Update prices, detect anomalies
3. **Format Validator** - Check legality, track bans

Each module will:
- Use the types from `types.ts`
- Use query helpers from `db-queries.ts`
- Use job framework from `job-runner.ts`
- Export its main functions in `index.ts`

## Performance Considerations

### Caching Thresholds
- Price updates: 2-hour cache (slow to change)
- Meta data: 6-hour cache (format shifts gradually)
- Banned lists: 24-hour cache (change rarely)

### Database Indices
All new tables have indices on frequently-queried fields:
- `price_history`: `(cardName, capturedAt DESC)`
- `deck_analysis`: `(userId, analyzedAt DESC)`
- `card_synergies`: `(cardName)`, `(synergyPartner)`
- `suggestions`: `(userId, suggestedAt DESC)`, `(userId, adopted)`
- `banned_list_snapshots`: `(format, snapshotDate DESC)`
- `community_venues`: `(city, state)`

### Rate Limiting
Built-in rate limiter prevents job flood:
```typescript
if (rateLimiter.canExecute('price_update', 5000)) {
  // Only runs if 5 seconds have passed since last execution
}
```

## Common Patterns

### Pattern 1: Record then Query
```typescript
await recordPriceSnapshot('Card', 'scryfall', 10.0, null);
const latest = await getLatestPrice('Card');
```

### Pattern 2: Check Staleness
```typescript
if (isDataStale('cache-key', JOB_THRESHOLDS.PRICE_UPDATE)) {
  // Trigger background refresh
  executeJobAsync('price_update', refreshFn);
}
```

### Pattern 3: Batch Processing
```typescript
const results = await processBatch(
  cards,
  async (card) => updatePrice(card),
  { batchSize: 100, delayMs: 500 }
);
```

## Files Created

```
lib/magic-agent/
├── index.ts              # Main export index
├── types.ts              # All TypeScript interfaces (60+ types)
├── job-runner.ts         # Background job framework
├── db-queries.ts         # Database query helpers
└── README.md             # This file

prisma/migrations/
└── 20260606113557_add_magic_agent_tables/
    └── migration.sql     # 7 new tables + modifications
```

## Key Learnings

1. **Lazy loading > Cron jobs** for serverless (no external dependencies)
2. **Smart caching** (return stale, refresh in background) optimizes UX
3. **Centralized types** make development faster and safer
4. **Query helpers** reduce boilerplate in agent modules
5. **Job framework** is application-agnostic (reusable in any module)

## Status Summary

| Component | Status | Tests |
|-----------|--------|-------|
| Database Migration | ✅ Complete | Applied to dev.db |
| Type Definitions | ✅ Complete | 60+ types defined |
| Job Runner | ✅ Complete | Lazy on-demand ready |
| DB Queries | ✅ Complete | All helper functions ready |
| Index Export | ✅ Complete | Ready for import |

**Week 1 Ready**: ✅ All infrastructure in place. Ready for Week 2 agent modules.
