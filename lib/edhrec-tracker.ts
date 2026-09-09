import { findMany, run, withTimeout } from '@/lib/db';
import { getPopularCommanders } from '@/lib/edhrec';
import { randomUUID } from 'crypto';

const USER_AGENT = 'MTGDeckBuilder/1.0 (+https://mtgdeckfinder.com)';

async function query<T = any>(sql: string, args: any[], timeoutMs = 15000): Promise<T[]> {
  return withTimeout(timeoutMs, async (q) => (await q(sql, args)).rows as T[]);
}

interface EdhrecCardView {
  name: string;
  num_decks?: number;
  potential_decks?: number;
}
interface EdhrecPage {
  container?: { json_dict?: { cardlists?: Array<{ cardviews: EdhrecCardView[] }> } };
}

interface CardRate { cardName: string; numDecks: number; potentialDecks: number; inclusionRate: number }

/** Same EDHREC page lib/edhrec.ts fetches for deck-building suggestions,
 * but keeping the num_decks/potential_decks this tracker needs instead of
 * collapsing straight to a quantity. Separate fetch (no shared cache) since
 * this runs once/day from the cron, not per deck-building request. */
async function fetchCommanderCardRates(slug: string): Promise<CardRate[]> {
  const res = await fetch(`https://json.edhrec.com/pages/commanders/${slug}.json`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return [];
  const data: EdhrecPage = await res.json();
  const cardlists = data?.container?.json_dict?.cardlists ?? [];

  const seen = new Set<string>();
  const rates: CardRate[] = [];
  for (const section of cardlists) {
    for (const cv of section.cardviews) {
      if (!cv.name || seen.has(cv.name)) continue;
      if (!cv.num_decks || !cv.potential_decks) continue;
      seen.add(cv.name);
      rates.push({ cardName: cv.name, numDecks: cv.num_decks, potentialDecks: cv.potential_decks, inclusionRate: cv.num_decks / cv.potential_decks });
    }
  }
  return rates;
}

/** Snapshots today's EDHREC inclusion rate for every card in every tracked
 * popular commander's page — one row per (commander, card, day). Run daily
 * from the cron; the point is to accumulate history so "did rising
 * popularity precede a price move" becomes answerable over time, not to
 * recompute anything from a single day's data. */
export async function refreshEdhrecSnapshots(): Promise<{ commandersFetched: number; rowsUpserted: number }> {
  const commanders = getPopularCommanders();
  let commandersFetched = 0;
  let rowsUpserted = 0;

  for (const c of commanders) {
    const rates = await fetchCommanderCardRates(c.slug);
    if (rates.length === 0) continue;
    commandersFetched++;

    for (const r of rates) {
      await run(
        `INSERT INTO edhrec_card_snapshots (id, commander_slug, commander_name, card_name, num_decks, potential_decks, inclusion_rate, snapshot_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
         ON CONFLICT (commander_slug, card_name, snapshot_date)
         DO UPDATE SET num_decks = EXCLUDED.num_decks, potential_decks = EXCLUDED.potential_decks, inclusion_rate = EXCLUDED.inclusion_rate`,
        [randomUUID(), c.slug, c.name, r.cardName, r.numDecks, r.potentialDecks, r.inclusionRate]
      );
      rowsUpserted++;
    }
  }

  return { commandersFetched, rowsUpserted };
}

export interface PopularityPriceRow {
  cardName: string;
  scryfallId: string | null;
  commanderName: string;
  commanderSlug: string;
  inclusionRate: number;
  numDecks: number;
  priceUsd: number | null;
  priceDate: string | null;
  earliestInclusionRate: number | null;
  earliestDate: string | null;
  inclusionRateChangePct: number | null;
  priceChangeAbs: number | null;
  priceChangePct: number | null;
  daysTracked: number;
  // How many of the tracked commanders this card shows up under, as a
  // fraction — Sol Ring, Arcane Signet, Command Tower, basic lands, etc.
  // are near 1.0 (they're auto-includes almost everywhere) and drown out
  // the cards whose popularity is actually specific to one archetype.
  commanderCoveragePct: number;
  isStaple: boolean;
}

const BASIC_LAND_RE = /^(Plains|Island|Swamp|Mountain|Forest|Wastes|Snow-Covered (Plains|Island|Swamp|Mountain|Forest))$/;
// A card counts as a "staple" (filtered out by default) once it shows up
// under at least this fraction of all tracked commanders — chosen so
// genuinely archetype-specific cards (which cluster under a handful of
// related commanders, not the whole cross-color-pair spread) stay in.
const STAPLE_COVERAGE_THRESHOLD = 0.5;

/** Today's inclusion rate for every tracked (commander, card) pair, its
 * current tracked price (cheapest printing by name — same ambiguous-name
 * proxy lib/deck-value.ts uses, since EDHREC doesn't know printings), and
 * — once more than one day of snapshots exists — how both have moved since
 * the earliest snapshot in the lookback window. On day one of tracking,
 * the "change" fields are simply null; that's honest, not a bug. */
export async function getPopularityVsPrice(lookbackDays = 30): Promise<PopularityPriceRow[]> {
  const latest = await query<{ commanderSlug: string; commanderName: string; cardName: string; inclusionRate: number; numDecks: number; snapshotDate: string }>(
    `SELECT DISTINCT ON (commander_slug, card_name)
       commander_slug as "commanderSlug", commander_name as "commanderName", card_name as "cardName",
       inclusion_rate as "inclusionRate", num_decks as "numDecks", snapshot_date as "snapshotDate"
     FROM edhrec_card_snapshots
     ORDER BY commander_slug, card_name, snapshot_date DESC`,
    []
  );
  if (latest.length === 0) return [];

  const cardNames = Array.from(new Set(latest.map(r => r.cardName)));

  const totalCommanders = new Set(latest.map(r => r.commanderSlug)).size;
  const commandersByCard = new Map<string, Set<string>>();
  for (const r of latest) {
    const set = commandersByCard.get(r.cardName) ?? new Set<string>();
    set.add(r.commanderSlug);
    commandersByCard.set(r.cardName, set);
  }

  const earliest = await query<{ commanderSlug: string; cardName: string; inclusionRate: number; snapshotDate: string }>(
    `SELECT DISTINCT ON (commander_slug, card_name)
       commander_slug as "commanderSlug", card_name as "cardName", inclusion_rate as "inclusionRate", snapshot_date as "snapshotDate"
     FROM edhrec_card_snapshots
     WHERE snapshot_date >= CURRENT_DATE - ?::int
     ORDER BY commander_slug, card_name, snapshot_date ASC`,
    [lookbackDays]
  );
  const earliestByKey = new Map(earliest.map(r => [`${r.commanderSlug}|${r.cardName}`, r]));

  const daysTrackedRows = await query<{ commanderSlug: string; cardName: string; days: number }>(
    `SELECT commander_slug as "commanderSlug", card_name as "cardName", COUNT(DISTINCT snapshot_date)::int as days
     FROM edhrec_card_snapshots
     WHERE snapshot_date >= CURRENT_DATE - ?::int
     GROUP BY commander_slug, card_name`,
    [lookbackDays]
  );
  const daysByKey = new Map(daysTrackedRows.map(r => [`${r.commanderSlug}|${r.cardName}`, r.days]));

  // Per-name, per-date cheapest tracked printing (same ambiguous-name proxy
  // as lib/deck-value.ts). Pulled as a full per-date series, not just
  // "current price," so both the latest and the price as-of each card's
  // earliest EDHREC snapshot can be derived from the same methodology.
  const priceSeriesRows = cardNames.length > 0
    ? await query<{ cardName: string; priceDate: string; usd: string }>(
        `SELECT card_name as "cardName", price_date as "priceDate", MIN(usd) as usd
         FROM market_price_snapshots
         WHERE card_name = ANY(?) AND usd IS NOT NULL
         GROUP BY card_name, price_date
         ORDER BY card_name, price_date ASC`,
        [cardNames]
      )
    : [];
  const priceSeriesByName = new Map<string, Array<{ date: string; usd: number }>>();
  for (const r of priceSeriesRows) {
    const arr = priceSeriesByName.get(r.cardName) ?? [];
    arr.push({ date: r.priceDate, usd: Number(r.usd) });
    priceSeriesByName.set(r.cardName, arr);
  }

  // Just for linking to the card detail page — the cheapest printing as of
  // the most recent tracked date, one lookup, not per-day like the series above.
  const scryfallIdRows = cardNames.length > 0
    ? await query<{ cardName: string; scryfallId: string }>(
        `SELECT DISTINCT ON (card_name) card_name as "cardName", scryfall_id as "scryfallId"
         FROM market_price_snapshots
         WHERE card_name = ANY(?) AND usd IS NOT NULL
         ORDER BY card_name, price_date DESC, usd ASC`,
        [cardNames]
      )
    : [];
  const scryfallIdByName = new Map(scryfallIdRows.map(r => [r.cardName, r.scryfallId]));

  function priceAsOf(cardName: string, onOrBefore?: string): { usd: number; date: string } | null {
    const series = priceSeriesByName.get(cardName);
    if (!series || series.length === 0) return null;
    if (!onOrBefore) {
      const last = series[series.length - 1];
      return { usd: last.usd, date: last.date };
    }
    let picked: { date: string; usd: number } | null = null;
    for (const p of series) {
      if (p.date <= onOrBefore) picked = p;
      else break;
    }
    return picked ? { usd: picked.usd, date: picked.date } : null;
  }

  return latest.map(row => {
    const key = `${row.commanderSlug}|${row.cardName}`;
    const early = earliestByKey.get(key) ?? null;
    const currentPrice = priceAsOf(row.cardName);
    const earliestPrice = early ? priceAsOf(row.cardName, early.snapshotDate) : null;

    const inclusionRateChangePct = early && early.inclusionRate > 0 && early.snapshotDate !== row.snapshotDate
      ? ((row.inclusionRate - early.inclusionRate) / early.inclusionRate) * 100
      : null;
    const priceChangeAbs = currentPrice && earliestPrice && earliestPrice.date !== currentPrice.date
      ? currentPrice.usd - earliestPrice.usd
      : null;
    const priceChangePct = currentPrice && earliestPrice && earliestPrice.usd > 0 && earliestPrice.date !== currentPrice.date
      ? ((currentPrice.usd - earliestPrice.usd) / earliestPrice.usd) * 100
      : null;

    const commanderCoveragePct = totalCommanders > 0 ? (commandersByCard.get(row.cardName)?.size ?? 0) / totalCommanders : 0;
    const isStaple = BASIC_LAND_RE.test(row.cardName) || commanderCoveragePct >= STAPLE_COVERAGE_THRESHOLD;

    return {
      cardName: row.cardName,
      scryfallId: scryfallIdByName.get(row.cardName) ?? null,
      commanderName: row.commanderName,
      commanderSlug: row.commanderSlug,
      inclusionRate: row.inclusionRate,
      numDecks: row.numDecks,
      priceUsd: currentPrice?.usd ?? null,
      priceDate: currentPrice?.date ?? null,
      earliestInclusionRate: early?.inclusionRate ?? null,
      earliestDate: early?.snapshotDate ?? null,
      priceChangeAbs,
      inclusionRateChangePct,
      priceChangePct,
      daysTracked: daysByKey.get(key) ?? 1,
      commanderCoveragePct,
      isStaple,
    };
  });
}

/** Computes and caches getPopularityVsPrice() — run daily from the cron
 * right after refreshEdhrecSnapshots() writes today's row, so the page
 * reads a cheap single-row cache lookup instead of the multi-table scan
 * above on every request. */
export async function refreshEdhrecPopularityCache(): Promise<{ rowsCached: number }> {
  const rows = await getPopularityVsPrice();
  await run(
    `INSERT INTO market_movers_cache (id, cache_key, payload, computed_at)
     VALUES (?, ?, ?, now())
     ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [randomUUID(), 'edhrec_popularity_vs_price', JSON.stringify({ rows })]
  );
  return { rowsCached: rows.length };
}

export async function getCachedPopularityVsPrice(): Promise<{ rows: PopularityPriceRow[]; computedAt: string | null }> {
  const cached = await findMany<{ payload: { rows: PopularityPriceRow[] }; computed_at: string }>(
    `SELECT payload, computed_at FROM market_movers_cache WHERE cache_key = 'edhrec_popularity_vs_price'`
  );
  if (cached.length === 0) return { rows: [], computedAt: null };
  return { rows: cached[0].payload.rows ?? [], computedAt: cached[0].computed_at };
}
