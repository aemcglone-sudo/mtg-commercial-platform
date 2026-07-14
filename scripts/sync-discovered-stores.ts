/**
 * Store discovery sync — runs weekly (Sunday 2am ET on Fly.io).
 * Queries OSM Overpass API and Foursquare for MTG shops within 50 miles
 * of Atlanta (pilot), deduplicates, and upserts to discovered_stores.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PILOT_LAT = 33.749;
const PILOT_LNG = -84.388;
const RADIUS_METERS = 80450; // 50 miles

// OSM already filters to shop=games / leisure=game_centre, so all results are game stores.
// Name filter kept only to exclude very obvious non-MTG venues (e.g. chess-only clubs).
const EXCLUDE_KEYWORDS = /chess|poker|bingo|lottery|bowling|billiard|esport|video game/i;

interface RawStore {
  osm_id?: string;
  foursquare_id?: string;
  name: string;
  lat: number;
  lng: number;
  phone?: string;
  website_url?: string;
  hours_raw?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  sync_source: string;
}

function generateSlug(name: string, existingSlugs: Set<string>): string {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!existingSlugs.has(base)) return base;
  let i = 2;
  while (existingSlugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nameSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na) || na === nb;
}

function deduplicateStores(stores: RawStore[]): RawStore[] {
  const deduped: RawStore[] = [];
  for (const store of stores) {
    const match = deduped.find(
      d =>
        distanceMeters(d.lat, d.lng, store.lat, store.lng) < 100 &&
        nameSimilar(d.name, store.name)
    );
    if (match) {
      // Merge: keep osm_id from OSM, foursquare_id from FSQ, union source
      if (store.osm_id && !match.osm_id) match.osm_id = store.osm_id;
      if (store.foursquare_id && !match.foursquare_id) match.foursquare_id = store.foursquare_id;
      if (match.sync_source !== 'both') match.sync_source = 'both';
      // Prefer non-null fields from the new record
      if (!match.phone && store.phone) match.phone = store.phone;
      if (!match.website_url && store.website_url) match.website_url = store.website_url;
      if (!match.hours_raw && store.hours_raw) match.hours_raw = store.hours_raw;
    } else {
      deduped.push({ ...store });
    }
  }
  return deduped;
}

async function fetchOSMStores(): Promise<RawStore[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["shop"="games"](around:${RADIUS_METERS},${PILOT_LAT},${PILOT_LNG});
      way["shop"="games"](around:${RADIUS_METERS},${PILOT_LAT},${PILOT_LNG});
      node["leisure"="game_centre"](around:${RADIUS_METERS},${PILOT_LAT},${PILOT_LNG});
    );
    out body;
    >;
    out skel qt;
  `;
  console.log('[OSM] Fetching stores...');
  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    { headers: { Accept: '*/*', 'User-Agent': 'Grimoire/1.0' } }
  );
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const data = await res.json() as { elements: Array<{
    id: number; type: string; lat?: number; lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }> };

  return data.elements
    .filter(el => el.tags?.name && !EXCLUDE_KEYWORDS.test(el.tags.name))
    .filter(el => el.lat != null || el.center?.lat != null)
    .map(el => ({
      osm_id: String(el.id),
      name: el.tags!.name!,
      lat: el.lat ?? el.center!.lat,
      lng: el.lon ?? el.center!.lon,
      phone: el.tags?.['contact:phone'] ?? el.tags?.phone,
      website_url: el.tags?.website ?? el.tags?.['contact:website'],
      hours_raw: el.tags?.opening_hours,
      address: [el.tags?.['addr:housenumber'], el.tags?.['addr:street']].filter(Boolean).join(' ') || undefined,
      city: el.tags?.['addr:city'],
      state: el.tags?.['addr:state'],
      zip: el.tags?.['addr:postcode'],
      sync_source: 'osm',
    }));
}

async function fetchFoursquareStores(): Promise<RawStore[]> {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) { console.warn('[FSQ] No FOURSQUARE_API_KEY — skipping'); return []; }

  console.log('[FSQ] Fetching stores...');
  // Foursquare Places API — try new endpoint format
  const url = `https://api.foursquare.com/v3/places/search?query=magic+the+gathering+card+shop&ll=${PILOT_LAT},${PILOT_LNG}&radius=${RADIUS_METERS}&limit=50`;
  const res = await fetch(url, { headers: { Authorization: key, Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 410) {
      console.warn('[FSQ] Foursquare endpoint deprecated — skipping FSQ results');
    } else {
      console.warn(`[FSQ] Error ${res.status}: ${body.slice(0, 100)}`);
    }
    return [];
  }
  const data = await res.json() as { results: Array<{
    fsq_id: string; name: string;
    geocodes: { main: { latitude: number; longitude: number } };
    location: { address?: string; city?: string; region?: string; postcode?: string };
    tel?: string; website?: string;
  }> };

  return (data.results ?? []).map(r => ({
    foursquare_id: r.fsq_id,
    name: r.name,
    lat: r.geocodes.main.latitude,
    lng: r.geocodes.main.longitude,
    phone: r.tel,
    website_url: r.website,
    address: r.location.address,
    city: r.location.city,
    state: r.location.region,
    zip: r.location.postcode,
    sync_source: 'foursquare',
  }));
}

async function main() {
  console.log('[sync-discovered-stores] Starting...');

  const [osmStores, fsqStores] = await Promise.all([fetchOSMStores(), fetchFoursquareStores()]);
  console.log(`[sync] OSM: ${osmStores.length}, Foursquare: ${fsqStores.length}`);

  const allStores = deduplicateStores([...osmStores, ...fsqStores]);
  console.log(`[sync] After deduplication: ${allStores.length}`);

  // Match against Grimoire partner shops
  const { rows: partners } = await pool.query<{ id: string; name: string; lat: string | null; lng: string | null }>(
    `SELECT id, name, lat, lng FROM shops`
  );

  // Get existing slugs
  const { rows: existingRows } = await pool.query<{ slug: string }>(`SELECT slug FROM discovered_stores`);
  const existingSlugs = new Set(existingRows.map(r => r.slug));

  let upserted = 0;
  for (const store of allStores) {
    // Find matching partner by proximity + name
    const partner = partners.find(p => {
      if (!p.lat || !p.lng) return false;
      const dist = distanceMeters(store.lat, store.lng, parseFloat(p.lat), parseFloat(p.lng));
      return dist < 500 && nameSimilar(store.name, p.name);
    });

    // Check if already exists
    const { rows: existing } = await pool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM discovered_stores WHERE osm_id = $1 OR foursquare_id = $2`,
      [store.osm_id ?? null, store.foursquare_id ?? null]
    );

    if (existing.length > 0) {
      // Update
      await pool.query(
        `UPDATE discovered_stores SET
          name=$1, lat=$2, lng=$3, phone=$4, website_url=$5, hours_raw=$6,
          address=$7, city=$8, state=$9, zip=$10, sync_source=$11,
          grimoire_shop_id=$12, last_synced_at=NOW(), updated_at=NOW()
         WHERE id=$13`,
        [
          store.name, store.lat, store.lng, store.phone ?? null, store.website_url ?? null,
          store.hours_raw ?? null, store.address ?? null, store.city ?? null, store.state ?? null,
          store.zip ?? null, store.sync_source, partner?.id ?? null, existing[0].id,
        ]
      );
    } else {
      // Insert
      const slug = generateSlug(store.name, existingSlugs);
      existingSlugs.add(slug);
      await pool.query(
        `INSERT INTO discovered_stores
          (id, name, slug, osm_id, foursquare_id, grimoire_shop_id, address, city, state, zip,
           lat, lng, phone, website_url, hours_raw, sync_source, last_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())`,
        [
          randomUUID(), store.name, slug, store.osm_id ?? null, store.foursquare_id ?? null,
          partner?.id ?? null, store.address ?? null, store.city ?? null, store.state ?? null,
          store.zip ?? null, store.lat, store.lng, store.phone ?? null, store.website_url ?? null,
          store.hours_raw ?? null, store.sync_source,
        ]
      );
    }
    upserted++;
  }

  console.log(`[sync-discovered-stores] Done. Upserted ${upserted} stores.`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
