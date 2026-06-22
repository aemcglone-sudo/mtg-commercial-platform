# Phase 1: Architecture & Database Design

## Database Schema Extensions

### 1. Price Tracking

```sql
CREATE TABLE card_prices (
  id TEXT PRIMARY KEY,
  cardName TEXT NOT NULL,
  cardSetCode TEXT,
  
  -- Current prices
  priceUsd REAL,
  priceFoilUsd REAL,
  priceEur REAL,
  
  -- Meta
  source TEXT,  -- 'scryfall', 'tcgplayer'
  lastUpdated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(cardName, cardSetCode, source)
);

CREATE INDEX idx_prices_card ON card_prices(cardName);
CREATE INDEX idx_prices_date ON card_prices(lastUpdated DESC);

-- Historical data for trend analysis
CREATE TABLE price_history (
  id TEXT PRIMARY KEY,
  cardName TEXT NOT NULL,
  priceUsd REAL,
  priceFoilUsd REAL,
  recordedAt DATETIME NOT NULL,
  
  UNIQUE(cardName, recordedAt)
);

CREATE INDEX idx_price_history_card_date ON price_history(cardName, recordedAt DESC);
```

**Purpose**: Store current & historical prices for trend detection, alerts, valuation

---

### 2. Card Synergies

```sql
CREATE TABLE card_synergies (
  id TEXT PRIMARY KEY,
  cardName TEXT NOT NULL,
  synergyPartner TEXT NOT NULL,
  synergyType TEXT NOT NULL,
    -- 'combo' (infinite/game-winning)
    -- 'synergy' (works well together)
    -- 'tribal' (shared creature type)
    -- 'mana_fix' (ramp/color fix)
    -- 'removal' (works with sacrifice)
  
  strength REAL NOT NULL,  -- 0-1 scale
  explanation TEXT,  -- "Creates infinite tokens with Doubling Season"
  format TEXT,  -- 'commander', 'modern', etc. (NULL = all formats)
  
  UNIQUE(cardName, synergyPartner, synergyType)
);

CREATE INDEX idx_synergies_card ON card_synergies(cardName);
CREATE INDEX idx_synergies_partner ON card_synergies(synergyPartner);
CREATE INDEX idx_synergies_type ON card_synergies(synergyType);
```

**Purpose**: Pre-computed synergy relationships for highlighting & combo explanations

**Data source**: EDHREC (cards that appear together frequently), manual combo database, tournament decklists

---

### 3. Format Legality & Meta

```sql
CREATE TABLE format_cards (
  id TEXT PRIMARY KEY,
  cardName TEXT NOT NULL,
  format TEXT NOT NULL,  -- 'standard', 'pioneer', 'modern', 'commander', etc.
  
  legality TEXT NOT NULL,  -- 'legal', 'banned', 'restricted'
  bannedDate DATETIME,
  unbanDate DATETIME,
  
  UNIQUE(cardName, format)
);

CREATE INDEX idx_format_cards_format ON format_cards(format);
CREATE INDEX idx_format_cards_card ON format_cards(cardName);

-- Meta deck tracking
CREATE TABLE meta_decks (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  
  deckName TEXT,
  archetype TEXT,  -- 'Izzet Control', 'Rakdos Aggro', etc.
  colors TEXT,  -- JSON: {W: 0, U: 1, B: 0, R: 1, G: 0}
  mainboard TEXT,  -- JSON array of {name, quantity}
  
  metaShare REAL,  -- % of meta (0-100)
  winRate REAL,  -- % (0-100)
  
  source TEXT,  -- 'mtgtop8', 'goldfish', 'arena'
  recordedAt DATETIME NOT NULL,
  
  UNIQUE(format, archetype, recordedAt)
);

CREATE INDEX idx_meta_decks_format_date ON meta_decks(format, recordedAt DESC);
CREATE INDEX idx_meta_decks_archetype ON meta_decks(archetype);
```

**Purpose**: Track legal/banned status, detect format shifts, compare decks to meta

---

### 4. Collection Analytics

```sql
CREATE TABLE collection_stats (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE,
  
  -- Value tracking
  totalValueUsd REAL,
  totalValueTrend REAL,  -- change in last 7 days (%)
  
  -- Composition
  uniqueCardCount INTEGER,
  totalCardCount INTEGER,
  duplicateCount INTEGER,  -- cards with qty > 1
  
  -- By rarity
  mythicCount INTEGER,
  rareCount INTEGER,
  uncommonCount INTEGER,
  commonCount INTEGER,
  
  -- By set
  setsRepresented INTEGER,
  completedSets INTEGER,
  
  lastUpdated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Per-set completion tracking
CREATE TABLE set_progress (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  setCode TEXT NOT NULL,
  
  ownedCount INTEGER,
  totalCount INTEGER,  -- cards in set
  completionPercent REAL,
  estimatedValue REAL,
  
  UNIQUE(userId, setCode),
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_set_progress_user ON set_progress(userId);

-- Grading recommendations
CREATE TABLE grading_candidates (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  cardName TEXT NOT NULL,
  setCode TEXT,
  quantity INTEGER,
  
  currentPrice REAL,
  gradingCost REAL,  -- ~$15 per card
  minGradingValue REAL,  -- min value to justify grading
  recommendedGrade TEXT,  -- 'PSA 9', 'BGS 8', etc.
  
  UNIQUE(userId, cardName, setCode),
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_grading_user ON grading_candidates(userId);
```

**Purpose**: Dashboard data, set tracking, grading recommendations

---

### 5. Deck Analysis

```sql
CREATE TABLE deck_analysis (
  id TEXT PRIMARY KEY,
  deckId TEXT NOT NULL,
  
  -- Composition
  avgManaCost REAL,
  manaCurve TEXT,  -- JSON: {0: 2, 1: 4, 2: 6, ...}
  colorIdentity TEXT,  -- JSON: {W: 0.2, U: 0.3, B: 0.1, R: 0.2, G: 0.2}
  
  creatureCount INTEGER,
  instantSorceryCount INTEGER,
  enchantmentCount INTEGER,
  artifactCount INTEGER,
  landCount INTEGER,
  
  -- Synergies in deck
  synergyScore REAL,  -- 0-100, how many cards synergize
  topSynergies TEXT,  -- JSON: [{card1, card2, strength, type}]
  
  -- Format & meta
  formats TEXT,  -- JSON: ['commander', 'modern']
  formatLegality TEXT,  -- JSON: {commander: 'legal', modern: 'banned'}
  
  -- Missing pieces
  missingForMeta TEXT,  -- JSON: [{card, reason, approximate_cost}]
  
  lastAnalyzed DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY(deckId) REFERENCES decks(id) ON DELETE CASCADE
);

CREATE INDEX idx_deck_analysis_deck ON deck_analysis(deckId);
```

**Purpose**: Mana curve data, synergy analysis, format validation, missing pieces

---

## API Endpoints (Phase 1B-D)

### Collection Intelligence
```
GET /api/collection/dashboard
  → {totalValue, valueChange7d, uniqueCards, duplicates, 
     completedSets, setsInProgress}

GET /api/collection/set-progress/:setCode
  → {owned, total, completionPercent, value}

GET /api/collection/grading-candidates
  → [{cardName, currentPrice, recommendedGrade, justification}]

POST /api/collection/price-alerts
  → Subscribe to alerts for specific cards
```

### Deck Building
```
GET /api/deck/:id/analysis
  → {manaCurve, synergies, formatLegality, missingPieces}

GET /api/deck/suggestions/from-collection
  → [{deckName, yourCards, missingCards, missingCost}]

POST /api/deck/validate-legality
  → {format: 'commander', legality: 'legal'|'banned', violations: []}
```

### Quan Context
```
GET /api/collection-chat/context
  → {collection: {...}, meta: {...}, prices: {...}, trends: {...}}
```

---

## Background Jobs Architecture

### Daily Price Update (2 AM UTC)
```typescript
// /app/api/background/update-prices.ts
- Fetch top 100 cards from user collections (sample)
- Get prices from Scryfall API
- Store in card_prices
- Detect spikes (>5% change) → flag for alerts
- Archive to price_history
- Update collection_stats.totalValue
```

### Weekly Synergy Refresh (Sunday 3 AM UTC)
```typescript
// /app/api/background/update-synergies.ts
- Fetch latest EDHREC data
- Parse top 10k Commander decklists
- Identify card pairs that appear together >20% of time
- Score by frequency + combo value
- Update card_synergies table
- Flag new combos for Quan context
```

### Meta Update (Daily 6 AM UTC)
```typescript
// /app/api/background/update-meta.ts
- Fetch Top 8 from MTGTop8
- Fetch meta share from Goldfish
- Parse mainboards
- Store in meta_decks
- Detect format shifts (>3% change) → flag
- Calculate win rates by archetype
```

### Grading Analysis (Weekly)
```typescript
// /app/api/background/analyze-grading.ts
- For each user collection
- Identify cards >$50
- Check if grading would increase value (PSA 9/10)
- Calculate ROI (grading cost vs. value uplift)
- Store in grading_candidates
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────┐
│  External Data Sources                  │
├─────────────────────────────────────────┤
│ • Scryfall (prices)                     │
│ • MTGTop8 (meta decks)                  │
│ • Goldfish (meta stats)                 │
│ • EDHREC (synergies)                    │
└────────────┬────────────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │  Background Jobs   │
    │  (hourly/daily)    │
    └────────┬───────────┘
             │
    ┌────────┴──────────┬──────────────┬──────────────┐
    │                   │              │              │
    ▼                   ▼              ▼              ▼
┌──────────┐      ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Prices   │      │ Meta     │   │Synergies │   │ Legality │
│ (daily)  │      │ (daily)  │   │(weekly)  │   │ (static) │
└────┬─────┘      └────┬─────┘   └────┬─────┘   └────┬─────┘
     │                 │              │              │
     └─────────────────┴──────────────┴──────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  Analytics Engine    │
            │  /api/collection/    │
            │  /api/deck/          │
            └──────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    Dashboard    Quan      Alerts
```

---

## Implementation Priority

**Sprint 1 (Week 1)**: Database + Price Pipeline
- [ ] Create schema (prices, synergies, format_cards, collection_stats)
- [ ] Build Scryfall price fetcher
- [ ] Implement daily price update job
- [ ] Create `/api/collection/dashboard` (MVP: just total value)

**Sprint 2 (Week 2)**: Collection Intelligence
- [ ] Set completion tracking (`set_progress` table)
- [ ] Duplicate detection & solver UI
- [ ] Grading analysis (`grading_candidates` table)
- [ ] Price alerts system
- [ ] Enhanced dashboard with trends

**Sprint 3 (Week 3)**: Synergies & Format Data
- [ ] Load EDHREC data into `card_synergies`
- [ ] Load format legality (`format_cards`)
- [ ] Build synergy highlighter for deck editor
- [ ] Mana curve visualizer

**Sprint 4 (Week 4)**: Deck Intelligence
- [ ] Format legality checker
- [ ] Missing pieces identifier
- [ ] "Build from collection" filter
- [ ] Deck analysis API

**Sprint 5 (Week 5)**: Quan Integration
- [ ] Enhanced system prompt with all context
- [ ] Price context in recommendations
- [ ] Meta awareness in responses
- [ ] Budget build variants
- [ ] Combo explanations

---

## Key Decisions

1. **Price source**: Scryfall (free, comprehensive, fast)
2. **Synergy data**: EDHREC (frequency analysis) + combo database (manual)
3. **Meta source**: MTGTop8 + Goldfish (combine for accuracy)
4. **Update cadence**: Prices daily, synergies weekly, meta daily
5. **Storage**: SQLite (persisted on Fly.io volume) for all tracking data
6. **Alerts**: In-app notifications first (no email initially)

---

## Questions Before Building

1. **Priorities**: Start with price tracking first, or synergies?
2. **Collection scope**: Should this work for all formats, or focus on Commander initially?
3. **Grading ROI**: Should we recommend specific graders (PSA vs. BGS)?
4. **Budget tiers**: For budget builds, what price ranges? ($50, $150, $300?)
5. **Meta scope**: All formats, or just Commander/Modern/Standard?
