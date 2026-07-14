import { NextRequest, NextResponse } from 'next/server';
import { run, withClient } from '@/lib/db';
import { randomUUID } from 'crypto';
import { parseCardList, prepareText } from '@/lib/card-list-parser';
import { getCards, cardImageUrl, cardPrice } from '@/lib/scryfall';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface ScryfallCard {
  id: string; name: string; set: string; collector_number: string;
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
  prices: { usd: string | null; usd_foil: string | null };
  type_line?: string; colors?: string[]; color_identity?: string[];
  cmc?: number; rarity?: string;
}

function normName(s: string) {
  return s.toLowerCase().replace(/[''ʼ`´]/g, "'").replace(/[""]/g, '"');
}

async function fetchCollection(identifiers: { name?: string; set?: string }[]) {
  const CHUNK = 75;
  const found: ScryfallCard[] = [];
  const notFound: typeof identifiers = [];
  for (let i = 0; i < identifiers.length; i += CHUNK) {
    const chunk = identifiers.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk }),
      });
      if (res.ok) {
        const data = await res.json() as { data: ScryfallCard[]; not_found: typeof identifiers };
        found.push(...data.data);
        notFound.push(...(data.not_found ?? []));
      } else {
        notFound.push(...chunk);
      }
    } catch {
      notFound.push(...chunk);
    }
    if (i + CHUNK < identifiers.length) await new Promise(r => setTimeout(r, 110));
  }
  return { found, notFound };
}

interface CsvRow {
  name: string;
  set: string;
  collectorNumber: string;
  foil: boolean;
  quantity: number;
  scryfallId: string;
  condition: string;
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cur += ch;
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      cols.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

function parseManaBoxCsv(text: string): CsvRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const iName = idx('name');
  const iSet = idx('set code');
  const iCol = idx('collector number');
  const iFoil = idx('foil');
  const iQty = idx('quantity');
  const iScryfall = idx('scryfall id');
  const iCond = idx('condition');

  if (iName === -1 || iQty === -1) return [];

  const condMap: Record<string, string> = {
    mint: 'NM', near_mint: 'NM', lightly_played: 'LP',
    moderately_played: 'MP', heavily_played: 'HP', damaged: 'DMG',
    excellent: 'NM', good: 'LP', played: 'MP', poor: 'HP',
  };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[iName]?.trim();
    if (!name) continue;
    const rawCond = (cols[iCond]?.trim() ?? '').toLowerCase().replace(/\s+/g, '_');
    rows.push({
      name,
      set: cols[iSet]?.trim() ?? '',
      collectorNumber: cols[iCol]?.trim() ?? '',
      foil: (cols[iFoil]?.trim() ?? '').toLowerCase() === 'foil',
      quantity: parseInt(cols[iQty]?.trim() ?? '1', 10) || 1,
      scryfallId: iScryfall >= 0 ? (cols[iScryfall]?.trim() ?? '') : '',
      condition: condMap[rawCond] ?? 'NM',
    });
  }
  return rows;
}

function isManaBoxCsv(text: string): boolean {
  const firstLine = text.split('\n')[0]?.toLowerCase() ?? '';
  return firstLine.includes('binder name') || (firstLine.includes('scryfall id') && firstLine.includes('quantity'));
}

export async function POST(req: NextRequest) {
  const { jobId, text, shopId, mergeMode } = await req.json() as {
    jobId: string; text: string; shopId: string; mergeMode: 'replace' | 'add';
  };

  await run(`UPDATE inventory_upload_jobs SET status='processing', updated_at=NOW() WHERE id=?`, [jobId]);

  try {
    type Row = (string | number | boolean | null)[];
    const rows: Row[] = [];
    let totalParsed = 0;
    let skipped = 0;
    const notFoundNames: string[] = [];

    if (isManaBoxCsv(text)) {
      // ManaBox CSV: same name-based lookup as collector upload (proven reliable)
      const csvRows = parseManaBoxCsv(text);
      totalParsed = csvRows.length;

      // For double-faced cards (X // Y), Scryfall collection endpoint matches
      // reliably on the front face name only.
      const frontName = (name: string) => name.includes(' // ') ? name.split(' // ')[0].trim() : name;

      // Tokens are single generic words — skip silently, not counted as errors
      const isToken = (name: string) =>
        /^(Zombie|Treasure|Elemental|Soldier|Thopter|Plant|Goblin|Saproling|Spirit|Human|Warrior|Knight|Bird|Cat|Dragon|Insect|Beast|Elf|Angel|Demon|Devil|Food|Gold|Clue|Blood|Shard|Copy|Reflection|Spawn|Pest|Fractal|Shapeshifter|Sliver|Merfolk|Faerie|Wurm|Drake|Illusion|Bat|Rat|Skeleton|Vampire|Wolf|Boar|Bear|Frog|Fungus|Squid|Snake|Hydra|Golem|Servo|Thopter|Walker)$/.test(name.trim());

      const uniqueNames = [...new Set(
        csvRows.filter(r => !isToken(r.name)).map(r => frontName(r.name))
      )];
      const cardData = await getCards(uniqueNames);

      for (const csvRow of csvRows) {
        if (isToken(csvRow.name)) { skipped++; continue; }
        const card = cardData.get(frontName(csvRow.name)) ?? cardData.get(csvRow.name);
        if (!card) { skipped++; notFoundNames.push(csvRow.name); continue; }
        const imageUrl = cardImageUrl(card, 'normal') || null;
        const priceCents = csvRow.foil
          ? Math.round((card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : 0) * 100) || 100
          : Math.round(cardPrice(card) * 100) || 100;
        rows.push([
          randomUUID(), shopId, card.id, card.name,
          (csvRow.set || card.set).toUpperCase(),
          csvRow.collectorNumber || card.collector_number,
          csvRow.condition, csvRow.foil, csvRow.quantity, priceCents, imageUrl,
          card.type_line ?? null,
          JSON.stringify(card.colors ?? card.color_identity ?? []),
          card.cmc ?? null,
          card.rarity ?? null,
        ]);
      }
    } else {
      // Plain text card list format
      const parsed = parseCardList(prepareText(text));
      totalParsed = parsed.length;

      const phase1Ids = parsed.map(c => c.set ? { set: c.set, name: c.name } : { name: c.name });
      const { found: p1Found, notFound: p1NotFound } = await fetchCollection(phase1Ids);

      const retryIds = p1NotFound.filter(id => id.set && id.name).map(id => ({ name: id.name! }));
      let p2Found: ScryfallCard[] = [];
      if (retryIds.length > 0) {
        const p2 = await fetchCollection(retryIds);
        p2Found = p2.found;
      }

      const byName = new Map<string, ScryfallCard>();
      for (const card of p2Found) byName.set(normName(card.name), card);
      for (const card of p1Found) byName.set(normName(card.name), card);

      for (const line of parsed) {
        const card = byName.get(normName(line.name));
        if (!card) { skipped++; notFoundNames.push(line.name); continue; }
        const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
        const priceCents = card.prices.usd ? Math.round(parseFloat(card.prices.usd) * 100) : 100;
        rows.push([
          randomUUID(), shopId, card.id, card.name,
          (line.set ?? card.set).toUpperCase(),
          line.collectorNumber ?? card.collector_number,
          'NM', false, line.qty, priceCents, imageUrl,
          card.type_line ?? null,
          JSON.stringify(card.colors ?? card.color_identity ?? []),
          card.cmc ?? null,
          card.rarity ?? null,
        ]);
      }
    }

    // Deduplicate rows by (scryfallId, condition, foil) — sum quantities for dupes.
    // Required because PostgreSQL's ON CONFLICT DO UPDATE can't affect the same row twice in one batch.
    const deduped = new Map<string, Row>();
    for (const row of rows) {
      const key = `${row[2]}|${row[6]}|${row[7]}`;
      const existing = deduped.get(key);
      if (existing) {
        existing[8] = (existing[8] as number) + (row[8] as number);
      } else {
        deduped.set(key, [...row]);
      }
    }
    const dedupedRows = [...deduped.values()];

    // All DB writes on a single connection — check out once, release when done
    await withClient(async (q) => {
      if (mergeMode === 'replace') {
        await q('DELETE FROM shop_inventory WHERE "shopId" = ?', [shopId]);
      }

      const BATCH = 500;
      for (let i = 0; i < dedupedRows.length; i += BATCH) {
        const chunk = dedupedRows.slice(i, i + BATCH);
        const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())').join(',');
        await q(
          `INSERT INTO shop_inventory
             (id, "shopId", "scryfallId", "cardName", "setCode", "collectorNumber",
              condition, foil, quantity, "priceCents", "imageUrl",
              "typeLine", colors, cmc, rarity, "createdAt", "updatedAt")
           VALUES ${placeholders}
           ON CONFLICT ("shopId", "scryfallId", condition, foil)
           DO UPDATE SET quantity = shop_inventory.quantity + EXCLUDED.quantity, "updatedAt" = NOW()`,
          chunk.flat()
        );
        await q(
          `UPDATE inventory_upload_jobs SET added=?, updated_at=NOW() WHERE id=?`,
          [Math.min(i + BATCH, dedupedRows.length), jobId]
        );
      }

      await q(
        `UPDATE inventory_upload_jobs SET status='done', total=?, added=?, skipped=?, not_found_names=?, updated_at=NOW() WHERE id=?`,
        [totalParsed, rows.length, skipped, notFoundNames.length ? JSON.stringify(notFoundNames) : null, jobId]
      );
    });
  } catch (err) {
    await run(
      `UPDATE inventory_upload_jobs SET status='error', error_msg=?, updated_at=NOW() WHERE id=?`,
      [err instanceof Error ? err.message : 'Unknown error', jobId]
    );
  }

  return NextResponse.json({ ok: true });
}
