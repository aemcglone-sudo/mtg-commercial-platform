/**
 * Agentic collection parser — uses Claude Haiku to detect any export format
 * and extract card names + quantities, regardless of how the user exported.
 *
 * Strategy:
 *  1. Split the raw text into 150-line chunks.
 *  2. Send the first chunk to Claude: detect format + extract cards.
 *  3. Send remaining chunks in parallel batches of 3: extract cards only.
 *  4. The system prompt is prompt-cached (needs ≥4096 tokens for Haiku 4.5).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Collection } from './parse-collection';

const MODEL = 'claude-haiku-4-5-20251001';
const CHUNK_LINES = 150;
const CONCURRENCY = 3;

// ─── Schemas ────────────────────────────────────────────────────────────────

const CARD_ENTRY = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Normalized English card name — no set codes, no "A-" prefix, no collector numbers',
    },
    quantity: { type: 'integer', description: 'Number of copies owned, default 1' },
  },
  required: ['name', 'quantity'],
  additionalProperties: false,
} as const;

const FIRST_CHUNK_SCHEMA = {
  type: 'object',
  properties: {
    format_name: {
      type: 'string',
      description: 'Short human-readable label for the detected format, e.g. "MTGO Text", "Magic Arena", "Deckbox CSV", "TCGPlayer CSV", "Custom"',
    },
    cards: { type: 'array', items: CARD_ENTRY },
  },
  required: ['format_name', 'cards'],
  additionalProperties: false,
} as const;

const SUBSEQUENT_CHUNK_SCHEMA = {
  type: 'object',
  properties: {
    cards: { type: 'array', items: CARD_ENTRY },
  },
  required: ['cards'],
  additionalProperties: false,
} as const;

// ─── System prompt ───────────────────────────────────────────────────────────
// Must be ≥4096 tokens for Haiku 4.5 prompt caching to activate.
// This detailed guide justifies the length and improves extraction accuracy.

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
- Alchemy set codes like (Y22STX), (YSNC) — these are digital sets; strip the set code and normalize

Examples:
  Deck
  4 A-Blood Artist (JMP)
  2 A-Celestial Regulator (SNC)
  1 A-Circle of the Land Druid (HBG)
  3 Lightning Bolt (M10)
  Sideboard
  2 Duress (M21)

Format name: "Magic Arena"

### 3. Deckbox CSV / TSV
Spreadsheet exports from deckbox.org. Columns vary but typically include: Count, Name, Edition, Card Number, Condition, Language, Foil, Signed, Artist Proof, Altered Art, Misprint, Promo, Textless, My Price.

Examples (CSV):
  Count,Name,Edition,Card Number,Condition,Language,Foil,Signed,...
  4,Lightning Bolt,Magic 2010,148,Mint,English,,,,
  1,Brainstorm,Legends,38,Near Mint,English,,,,
  2,Path to Exile,Modern Masters,11,Good (Lightly Played),English,foil,,,

Examples (TSV, tab-separated):
  4\tLightning Bolt\tMagic 2010
  1\tBrainstorm\tLegends

Format name: "Deckbox CSV"

### 4. TCGPlayer CSV / Mass Entry
TCGPlayer exports have columns like: Quantity, Product Name, Set Name, Number, Rarity, Condition, TCG Market Price, TCG Low Price, TCG Direct Low.

Examples:
  Quantity,Product Name,Set Name,Number,Rarity,Condition,...
  4,"Lightning Bolt","Magic 2010","148","Common","Near Mint",...
  1,"Brainstorm","Commander Legends","291","Common","Near Mint",...

Format name: "TCGPlayer CSV"

### 5. Archidekt / Moxfield URL Import (MTGO variant)
Looks like MTGO text with optional tags. Example:
  4x Lightning Bolt *FOIL*
  1x Brainstorm (CMR)

Format name: "MTGO Text" (same normalization)

### 6. EDHREC / Custom JSON
Sometimes users paste JSON arrays:
  [{"name": "Lightning Bolt", "count": 4}, {"name": "Island", "count": 20}]

Format name: "Custom JSON"

### 7. Spreadsheet Copy-Paste
Users may copy-paste from Google Sheets or Excel. Columns may be in any order but typically include a quantity and name column. Delimiter may be tab, comma, or multiple spaces.

Examples:
  Lightning Bolt\t4\tMint
  Brainstorm\t1\tNM

  OR:

  Name           | Qty | Condition
  Lightning Bolt | 4   | NM
  Brainstorm     | 1   | NM

Format name: "Spreadsheet"

### 8. Plain Card List (no quantities)
Some users provide a list with no quantities — each card appears once per copy owned.

Examples:
  Lightning Bolt
  Lightning Bolt
  Lightning Bolt
  Lightning Bolt
  Brainstorm
  Island
  Island

Format name: "Card List (no quantities)"

### 9. ManaBox CSV
ManaBox is a popular MTG collection app. Its CSV exports have these columns:
  Binder Name, Binder Type, Name, Set code, Set name, Collector number, Foil, Rarity, Quantity, ManaBox ID, Scryfall ID, Purchase price, ...

The card NAME is in the 3rd column (after Binder Name and Binder Type). Card names are quoted when they contain commas.
The QUANTITY is in the 9th column.

Examples:
  New Stuff,binder,"Sheoldred, the Apocalypse",DMU,Dominaria United,107,normal,mythic,1,...
  Bloomborrow,binder,Treetop Sentries,BLB,Bloomburrow,201,normal,common,1,...
  LOTR,binder,"Frodo, Adventurous Hobbit",LTC,Tales of Middle-earth Commander,2,normal,mythic,1,...

Format name: "ManaBox CSV"

---

## Normalization Rules

Apply ALL of these rules to every card name before including it in output:

### Strip Set Codes
Remove trailing (SET) and (SET) NNN patterns:
- "Lightning Bolt (M10)" → "Lightning Bolt"
- "Brainstorm (CMR) 291" → "Brainstorm"
- "Path to Exile (MH3) 42" → "Path to Exile"
- "Island (SHM) 287" → "Island"
- "A-Blood Artist (JMP)" → "Blood Artist"  ← also strips A- prefix

### Strip Arena "A-" Prefix
Remove the leading "A-" from Arena-rebalanced card names:
- "A-Blood Artist" → "Blood Artist"
- "A-Celestial Regulator" → "Celestial Regulator"
- "A-Circle of the Land Druid" → "Circle of the Land Druid"
- "A-Lightning Bolt" → "Lightning Bolt"

### Strip Foil / Special Markers
Remove suffixes like *F*, *FOIL*, [FOIL], (Foil), *E*, *PROMO*:
- "Lightning Bolt *F*" → "Lightning Bolt"
- "Brainstorm *FOIL*" → "Brainstorm"

### Strip Collector Numbers Embedded in Names
Some exports include the collector number in the name field:
- "Lightning Bolt #148" → "Lightning Bolt"
- "Brainstorm 291" (when preceded by a card name) → "Brainstorm"

### Handle Split / Adventure / Double-Faced Cards
Use the full combined name exactly as printed if both halves are present, or just the front face name:
- "Fire // Ice" or "Fire/Ice" → "Fire // Ice"
- "Bonecrusher Giant" (Adventure half "Stomp") → "Bonecrusher Giant"
- "Delver of Secrets" / "Insectile Aberration" → "Delver of Secrets"

### Handle Alternate Printings / Promos
Use the base card name, ignoring set-specific suffixes or promos:
- "Lightning Bolt (Borderless)" → "Lightning Bolt"
- "Island (Full Art)" → "Island"

### Skip Lines That Are Not Cards
Skip these entirely — do NOT attempt to parse them as cards:
- Empty lines
- Comment lines starting with // or #
- Section headers: "Deck", "Sideboard", "Maindeck", "Commander", "Companion", "Tokens"
- Column headers from CSV exports (lines containing "Quantity,Name" or "Count,Name" etc.)
- Lines containing only numbers

### Default Quantity
If a line contains a card name but no discernible quantity, assume quantity = 1.

---

## Output Requirements

Return ONLY valid JSON matching the schema. Do not include any prose, explanation, or markdown.

For the FIRST chunk, also include the format_name field.
For SUBSEQUENT chunks, include only the cards array.

If a chunk contains no parseable cards (e.g. all comment lines), return an empty cards array.

Never include:
- Basic land names like Plains, Island, Swamp, Mountain, Forest unless they are explicitly listed in the collection text (some formats omit basics; others include them)
- Cards with quantity 0

---

## Examples of Correct Parsing

Input (MTGO):
  4 Lightning Bolt
  4 Counterspell
  1 Force of Will
  20 Island
  // Sideboard
  2 Flusterstorm

Output:
  {"format_name":"MTGO Text","cards":[{"name":"Lightning Bolt","quantity":4},{"name":"Counterspell","quantity":4},{"name":"Force of Will","quantity":1},{"name":"Island","quantity":20},{"name":"Flusterstorm","quantity":2}]}

---

Input (Arena):
  Deck
  4 A-Blood Artist (JMP)
  2 Lightning Bolt (M10)
  Sideboard
  1 A-Duress (M21)

Output:
  {"format_name":"Magic Arena","cards":[{"name":"Blood Artist","quantity":4},{"name":"Lightning Bolt","quantity":2},{"name":"Duress","quantity":1}]}

---

Input (Deckbox CSV, continuation chunk):
  3,"Path to Exile","Modern Masters","11","Near Mint","English",,,
  1,"Brainstorm","Legends","38","Near Mint","English",,,

Output:
  {"cards":[{"name":"Path to Exile","quantity":3},{"name":"Brainstorm","quantity":1}]}

---

Input (TCGPlayer CSV):
  4,"Ragavan, Nimble Pilferer","Modern Horizons 2","138","Mythic Rare","Near Mint"
  2,"Wrenn and Six","Modern Horizons","217","Mythic Rare","Near Mint"

Output:
  {"cards":[{"name":"Ragavan, Nimble Pilferer","quantity":4},{"name":"Wrenn and Six","quantity":2}]}

---

Input (Spreadsheet copy-paste):
  Name\tQty
  Thoughtseize\t4
  Fatal Push\t4
  Dark Confidant\t2

Output:
  {"cards":[{"name":"Thoughtseize","quantity":4},{"name":"Fatal Push","quantity":4},{"name":"Dark Confidant","quantity":2}]}

---

## Edge Cases

- If the same card appears multiple times in a chunk (e.g., listed in both main deck and sideboard), include each occurrence separately. The caller will sum them.
- Commas inside quoted strings in CSV should not be treated as field separators: "Ragavan, Nimble Pilferer" is one field.
- Card names may contain apostrophes, hyphens, commas, colons, and other punctuation — preserve them exactly.
- Some cards have numeric names (e.g. "1996 World Champion") — context determines if a number is a quantity or a name.
- Japanese/non-English card names should be converted to their canonical English names if recognizable; otherwise keep as-is.

Be conservative: when in doubt about whether a line is a valid card entry, include it with quantity 1 rather than skip it.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const client = new Anthropic();

interface CardEntry { name: string; quantity: number }
interface FirstChunkResult { format_name: string; cards: CardEntry[] }
interface SubsequentChunkResult { cards: CardEntry[] }

async function callClaude<T>(
  userContent: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema,
      },
    },
    messages: [{ role: 'user', content: userContent }],
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text block in Claude response');
  return JSON.parse(block.text) as T;
}

function buildChunks(text: string): string[][] {
  const lines = text.split('\n');
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += CHUNK_LINES) {
    const slice = lines.slice(i, i + CHUNK_LINES);
    if (slice.some((l) => l.trim())) chunks.push(slice); // skip all-blank chunks
  }
  return chunks;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function parseCollectionWithClaude(
  text: string,
): Promise<{ collection: Collection; detectedFormat: string }> {
  const chunks = buildChunks(text);
  if (chunks.length === 0) return { collection: new Map(), detectedFormat: 'Unknown' };

  // First chunk: detect format + extract cards
  const firstResult = await callClaude<FirstChunkResult>(
    `Detect the format and extract all cards from this collection chunk (this is the first/only chunk):\n\n${chunks[0].join('\n')}`,
    FIRST_CHUNK_SCHEMA,
  );

  const allCards: CardEntry[] = [...firstResult.cards];
  const detectedFormat = firstResult.format_name || 'Unknown';

  // Remaining chunks: extract cards in parallel batches of CONCURRENCY
  for (let i = 1; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk, batchIndex) =>
        callClaude<SubsequentChunkResult>(
          `Extract all cards from this collection chunk (chunk ${i + batchIndex + 1} of ${chunks.length}):\n\n${chunk.join('\n')}`,
          SUBSEQUENT_CHUNK_SCHEMA,
        ),
      ),
    );
    for (const r of results) allCards.push(...r.cards);
  }

  // Aggregate into a Map (sum quantities for duplicate names)
  const collection: Collection = new Map();
  for (const card of allCards) {
    if (card.name?.trim() && card.quantity > 0) {
      const key = card.name.trim();
      collection.set(key, (collection.get(key) ?? 0) + card.quantity);
    }
  }

  return { collection, detectedFormat };
}
