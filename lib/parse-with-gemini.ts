/**
 * Collection parser using Google Gemini API.
 * Splits large collections into 150-line chunks and processes them,
 * with the first chunk detecting the format.
 */

import type { Collection } from './parse-collection';

const MODEL = 'gemini-3.1-flash-lite';
const CHUNK_LINES = 150;
const CONCURRENCY = 3;

// ─── Schemas ────────────────────────────────────────────────────────────────

const CARD_ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Normalized English card name — no set codes, no "A-" prefix, no collector numbers' },
    quantity: { type: 'integer', description: 'Number of copies owned, default 1' },
  },
  required: ['name', 'quantity'],
};

const FIRST_CHUNK_SCHEMA = {
  type: 'object',
  properties: {
    format_name: { type: 'string', description: 'Short human-readable label, e.g. "MTGO Text", "ManaBox CSV", "Magic Arena"' },
    cards: { type: 'array', items: CARD_ENTRY_SCHEMA },
  },
  required: ['format_name', 'cards'],
};

const SUBSEQUENT_CHUNK_SCHEMA = {
  type: 'object',
  properties: {
    cards: { type: 'array', items: CARD_ENTRY_SCHEMA },
  },
  required: ['cards'],
};

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Magic: The Gathering card collection parser. Your sole job is to extract card names and quantities from any collection export format a player might provide.

## Your Task

Given a chunk of text from a Magic: The Gathering card collection, you must:
1. Extract every card entry with its quantity.
2. Normalize card names to their canonical English paper names.
3. Return a clean JSON response matching the required schema.

When processing the FIRST chunk of a collection, also identify the export format.

---

## Supported Export Formats

### 1. MTGO / Moxfield Plain Text
The most common format. One card per line: quantity then name, optional set code and collector number.

Examples:
  4 Lightning Bolt
  1 Brainstorm
  2 Path to Exile (MH3) 42
  4 Counterspell (TSP) 72
  20 Island
  // This is a comment — skip it
  Sideboard
  2 Surgical Extraction

Format name: "MTGO Text"

### 2. Magic Arena Export
Similar to MTGO but may include:
- An "A-" prefix for Arena-rebalanced cards (e.g. "A-Blood Artist")
- Set code in parentheses WITHOUT a collector number (e.g. "4 A-Blood Artist (JMP)")
- Section headers like "Deck", "Sideboard", "Commander", "Companion"

Examples:
  Deck
  4 A-Blood Artist (JMP)
  2 A-Celestial Regulator (SNC)
  3 Lightning Bolt (M10)
  Sideboard
  2 Duress (M21)

Format name: "Magic Arena"

### 3. Deckbox CSV
Columns: Count, Name, Edition, Card Number, Condition, Language, Foil, ...

Example:
  Count,Name,Edition,...
  4,Lightning Bolt,Magic 2010,...

Format name: "Deckbox CSV"

### 4. TCGPlayer CSV
Columns: Quantity, Product Name, Set Name, Number, Rarity, Condition, ...

Example:
  Quantity,Product Name,...
  4,"Lightning Bolt","Magic 2010",...

Format name: "TCGPlayer CSV"

### 5. ManaBox CSV
Columns: Binder Name, Binder Type, Name, Set code, Set name, Collector number, Foil, Rarity, Quantity, ManaBox ID, ...

The card NAME is in the 3rd column. QUANTITY is in the 9th column.
Card names are quoted when they contain commas.

Examples:
  New Stuff,binder,"Sheoldred, the Apocalypse",DMU,Dominaria United,107,normal,mythic,1,...
  Bloomborrow,binder,Treetop Sentries,BLB,Bloomburrow,201,normal,common,1,...

Format name: "ManaBox CSV"

### 6. Custom JSON
  [{"name": "Lightning Bolt", "count": 4}, ...]

Format name: "Custom JSON"

### 7. Plain Card List (no quantities)
Each card appears once per copy owned.

Format name: "Card List (no quantities)"

---

## Normalization Rules

- Strip set codes: "Lightning Bolt (M10)" → "Lightning Bolt"
- Strip Arena "A-" prefix: "A-Blood Artist" → "Blood Artist"
- Strip foil markers: "Lightning Bolt *FOIL*" → "Lightning Bolt"
- Skip blank lines, comments (// or #), section headers (Deck, Sideboard, Commander, etc.)
- Skip CSV header rows (lines containing "Quantity,Name", "Count,Name", etc.)
- Default quantity = 1 if no quantity is found

---

## Output Requirements

Return ONLY valid JSON matching the schema. No prose, no markdown.

For the FIRST chunk, include format_name + cards.
For SUBSEQUENT chunks, include only cards.

If a chunk has no parseable cards, return an empty cards array.
Never include cards with quantity 0.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface CardEntry { name: string; quantity: number }
interface FirstChunkResult { format_name: string; cards: CardEntry[] }
interface SubsequentChunkResult { cards: CardEntry[] }

async function callGemini<T>(userContent: string, schema: object): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GOOGLE_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body}`);
  }

  const data = await res.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return JSON.parse(text) as T;
}

function buildChunks(text: string): string[][] {
  const lines = text.split('\n');
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += CHUNK_LINES) {
    const slice = lines.slice(i, i + CHUNK_LINES);
    if (slice.some((l) => l.trim())) chunks.push(slice);
  }
  return chunks;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function parseCollectionWithGemini(
  text: string,
): Promise<{ collection: Collection; detectedFormat: string }> {
  const chunks = buildChunks(text);
  if (chunks.length === 0) return { collection: new Map(), detectedFormat: 'Unknown' };

  const firstResult = await callGemini<FirstChunkResult>(
    `Detect the format and extract all cards from this collection chunk (first/only chunk):\n\n${chunks[0].join('\n')}`,
    FIRST_CHUNK_SCHEMA,
  );

  const allCards: CardEntry[] = [...firstResult.cards];
  const detectedFormat = firstResult.format_name || 'Unknown';

  for (let i = 1; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk, batchIndex) =>
        callGemini<SubsequentChunkResult>(
          `Extract all cards from this collection chunk (chunk ${i + batchIndex + 1} of ${chunks.length}):\n\n${chunk.join('\n')}`,
          SUBSEQUENT_CHUNK_SCHEMA,
        ),
      ),
    );
    for (const r of results) allCards.push(...r.cards);
  }

  const collection: Collection = new Map();
  for (const card of allCards) {
    if (card.name?.trim() && card.quantity > 0) {
      const key = card.name.trim();
      collection.set(key, (collection.get(key) ?? 0) + card.quantity);
    }
  }

  return { collection, detectedFormat };
}
