export interface ParsedCardLine {
  qty: number;
  name: string;
  set: string | null;
  collectorNumber: string | null;
}

// Windows-1252 special range (0x80–0x9F) that diverges from Unicode
const W1252: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„',
  0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ',
  0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ',
  0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“',
  0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

// Strip RTF markup from macOS-generated .rtf files, returning plain text.
export function prepareText(raw: string): string {
  if (!raw.trimStart().startsWith('{\\rtf')) return raw;
  let t = raw;
  // 1. Decode Windows-1252 escape sequences \'XX
  t = t.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return W1252[code] ?? String.fromCharCode(code);
  });
  // 2. Backslash + literal newline = RTF soft line break → newline
  t = t.replace(/\\\n/g, '\n');
  // 3. Remove RTF control words (\word or \word123), consuming optional trailing space
  t = t.replace(/\\[a-zA-Z]+-?\d*[ ]?/g, '');
  // 4. Remove remaining RTF control symbols (\X)
  t = t.replace(/\\./g, '');
  // 5. Remove group delimiters
  t = t.replace(/[{}]/g, '');
  // 6. Normalize — trim each line, drop empties
  return t.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

const SKIP_LINES = new Set(['deck', 'sideboard', 'commander', 'companion', 'maybeboard']);

export function parseCardList(text: string): ParsedCardLine[] {
  const lines = text.split(/\r?\n/);
  const map = new Map<string, ParsedCardLine>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || SKIP_LINES.has(line.toLowerCase())) continue;

    // Fix missing space after quantity: "1CardName" → "1 CardName"
    const normalized = line.replace(/^(\d+)([A-Za-z])/, '$1 $2');

    let parsed: ParsedCardLine | null = null;

    // MTGA/Moxfield format: "1 Card Name (SET) 123"
    const mtgaMatch = normalized.match(/^(\d+)\s+(.+?)\s+\(([A-Za-z0-9]+)\)\s+(\S+)$/);
    if (mtgaMatch) {
      parsed = {
        qty: parseInt(mtgaMatch[1], 10),
        name: mtgaMatch[2].trim(),
        set: mtgaMatch[3].toLowerCase(),
        collectorNumber: mtgaMatch[4],
      };
    }

    // Comma format: "1 Card Name, SET, 123"
    // Card names can contain commas (e.g. "Daxos, Blessed by the Sun")
    // so split from the right — last two tokens are set + number
    if (!parsed) {
      const parts = normalized.split(',');
      if (parts.length >= 3) {
        const numPart = parts[parts.length - 1].trim();
        const setPart = parts[parts.length - 2].trim();
        const namePart = parts.slice(0, parts.length - 2).join(',').trim();
        const qtyNameMatch = namePart.match(/^(\d+)\s+(.+)$/);
        if (
          qtyNameMatch &&
          /^[A-Za-z0-9]+$/.test(setPart) &&
          /^\d/.test(numPart)
        ) {
          parsed = {
            qty: parseInt(qtyNameMatch[1], 10),
            name: qtyNameMatch[2].trim(),
            set: setPart.toLowerCase(),
            collectorNumber: numPart,
          };
        }
      }
    }

    // Fallback: "1 Card Name"
    if (!parsed) {
      const basicMatch = normalized.match(/^(\d+)\s+(.+)$/);
      if (basicMatch) {
        parsed = {
          qty: parseInt(basicMatch[1], 10),
          name: basicMatch[2].trim(),
          set: null,
          collectorNumber: null,
        };
      }
    }

    if (!parsed) continue;

    // Deduplicate: combine quantities for the same card
    const key = parsed.set && parsed.collectorNumber
      ? `${parsed.set}:${parsed.collectorNumber}`
      : parsed.name.toLowerCase();

    const existing = map.get(key);
    if (existing) {
      existing.qty += parsed.qty;
    } else {
      map.set(key, parsed);
    }
  }

  return Array.from(map.values());
}
