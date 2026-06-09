export interface CollectionCard {
  name: string;
  quantity: number;
}

export type Collection = Map<string, number>;

/**
 * Parses CSV format (ManaBox, TCGPlayer, etc.):
 *   Name,Quantity,...
 *   Lightning Bolt,4,...
 * Handles quoted fields that contain commas.
 */
function parseCSV(text: string): Collection {
  const collection: Collection = new Map();
  const lines = text.split('\n');

  if (lines.length < 2) return collection;

  // Parse header row, handling quoted fields
  const headerFields = parseCSVLine(lines[0]);
  const header = headerFields.map(h => h.toLowerCase());
  const nameIdx = header.findIndex(h => h === 'name');
  const qtyIdx = header.findIndex(h => h === 'quantity' || h === 'qty');

  if (nameIdx === -1 || qtyIdx === -1) return collection;

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length <= Math.max(nameIdx, qtyIdx)) continue;

    const name = fields[nameIdx];
    const qty = parseInt(fields[qtyIdx], 10);

    if (name && qty > 0) {
      collection.set(name, (collection.get(name) ?? 0) + qty);
    }
  }

  return collection;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 * Handles cases like: "Sheoldred, the Apocalypse",DMU,Dominaria United,...
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    fields.push(current.trim().replace(/^"|"$/g, ''));
  }

  return fields;
}

/**
 * Parses MTGO/Moxfield/Arena plain-text format:
 *   4 Lightning Bolt
 *   1 Island (SHM) 287        ← MTGO: set code + collector number
 *   1 A-Blood Artist (JMP)    ← Arena: A- prefix + set code, no collector number
 *   // comment lines are skipped
 *   Sideboard:
 */
function parsePlainText(text: string): Collection {
  const collection: Collection = new Map();

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    // skip blanks, comments, section headers
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    if (/^(sideboard|maindeck|commander|companion):?$/i.test(line)) continue;

    // match: <qty> <card name> [optional (SET) and/or collector number]
    const match = line.match(/^(\d+)x?\s+(.+?)(?:\s+\([A-Z0-9]+\)(?:\s+\d+)?)?(?:\s+\*[A-Z]+\*)?$/);
    if (!match) continue;

    const qty = parseInt(match[1], 10);
    let name = match[2].trim().replace(/\s*\*.*\*$/, '');

    // Strip Arena "A-" prefix — these are rebalanced digital-only versions;
    // the paper name works for deck matching and Scryfall lookups.
    if (name.startsWith('A-')) name = name.slice(2);

    if (name && qty > 0) {
      collection.set(name, (collection.get(name) ?? 0) + qty);
    }
  }

  return collection;
}

/**
 * Auto-detect format (CSV or plain text) and parse accordingly
 */
export function parseCollection(text: string): Collection {
  // Detect CSV by looking for header row with "Name" and "Quantity"
  const firstLine = text.split('\n')[0].toLowerCase();
  if (firstLine.includes('name') && firstLine.includes('quantity')) {
    return parseCSV(text);
  }

  // Otherwise try plain text format
  return parsePlainText(text);
}

export function collectionToMap(cards: CollectionCard[]): Collection {
  const m: Collection = new Map();
  for (const c of cards) m.set(c.name, (m.get(c.name) ?? 0) + c.quantity);
  return m;
}
