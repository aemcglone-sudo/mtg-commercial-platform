export interface CollectionCard {
  name: string;
  quantity: number;
}

export type Collection = Map<string, number>;

export interface PrintingMeta {
  quantity: number;
  scryfallId?: string;
  setCode?: string;
  collectorNumber?: string;
  finish?: string; // 'foil' | 'nonfoil' | 'etched'
}

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

/**
 * Same auto-detection as parseCollection, but also captures per-printing
 * identity (Scryfall ID, set code, collector number, finish) when the CSV
 * provides it — e.g. ManaBox exports include a "Scryfall ID" column that
 * pins down the exact printing, rather than leaving it to an arbitrary
 * name-only Scryfall lookup that could land on a $1 or a $100 version of
 * the same card name.
 */
export function parseCollectionWithPrintings(text: string): Map<string, PrintingMeta> {
  const firstLine = text.split('\n')[0].toLowerCase();
  const isCSV = firstLine.includes('name') && firstLine.includes('quantity');

  if (!isCSV) {
    const base = parsePlainText(text);
    const out = new Map<string, PrintingMeta>();
    for (const [name, quantity] of base) out.set(name, { quantity });
    return out;
  }

  const out = new Map<string, PrintingMeta>();
  const lines = text.split('\n');
  if (lines.length < 2) return out;

  const headerFields = parseCSVLine(lines[0]);
  const header = headerFields.map(h => h.toLowerCase().trim());
  const nameIdx = header.findIndex(h => h === 'name');
  const qtyIdx = header.findIndex(h => h === 'quantity' || h === 'qty');
  if (nameIdx === -1 || qtyIdx === -1) return out;

  const scryfallIdx = header.findIndex(h => h === 'scryfall id' || h === 'scryfallid' || h === 'scryfall_id');
  const setIdx = header.findIndex(h => h === 'set code' || h === 'setcode' || h === 'set' || h === 'edition');
  const cnIdx = header.findIndex(h => h === 'collector number' || h === 'collectornumber' || h === 'card number' || h === 'number');
  const foilIdx = header.findIndex(h => h === 'foil' || h === 'finish' || h === 'printing');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length <= Math.max(nameIdx, qtyIdx)) continue;

    const name = fields[nameIdx];
    const qty = parseInt(fields[qtyIdx], 10);
    if (!name || !(qty > 0)) continue;

    const scryfallId = scryfallIdx !== -1 ? (fields[scryfallIdx]?.trim() || undefined) : undefined;
    const setCode = setIdx !== -1 ? (fields[setIdx]?.trim() || undefined) : undefined;
    const collectorNumber = cnIdx !== -1 ? (fields[cnIdx]?.trim() || undefined) : undefined;
    let finish = foilIdx !== -1 ? (fields[foilIdx]?.trim().toLowerCase() || undefined) : undefined;
    if (finish === 'normal') finish = 'nonfoil';

    const existing = out.get(name);
    if (existing) {
      existing.quantity += qty;
      // Keep the first printing identity we see for this name rather than overwrite —
      // still fixes the "arbitrary Scryfall default" problem since it anchors to a
      // printing the collector actually owns.
      if (!existing.scryfallId && scryfallId) {
        existing.scryfallId = scryfallId;
        existing.setCode = setCode;
        existing.collectorNumber = collectorNumber;
        existing.finish = finish;
      }
    } else {
      out.set(name, { quantity: qty, scryfallId, setCode, collectorNumber, finish });
    }
  }

  return out;
}

export function collectionToMap(cards: CollectionCard[]): Collection {
  const m: Collection = new Map();
  for (const c of cards) m.set(c.name, (m.get(c.name) ?? 0) + c.quantity);
  return m;
}
