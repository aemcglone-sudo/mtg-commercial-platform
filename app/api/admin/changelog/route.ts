import { NextRequest, NextResponse } from 'next/server';
import { findMany, run } from '@/lib/db';
import { getRole } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

type Entry = { id: string; date: string; type: string; description: string; created_at: string };

export async function GET(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const entries = await findMany<Entry>(
    `SELECT id, date::text, type, description, created_at FROM product_changelog ORDER BY date DESC, created_at DESC`
  );
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { type: string; description: string; date?: string };
  if (!body.type || !body.description) {
    return NextResponse.json({ error: 'type and description required' }, { status: 400 });
  }

  await run(
    `INSERT INTO product_changelog (id, date, type, description) VALUES (?, ?, ?, ?)`,
    [randomUUID(), body.date ?? new Date().toISOString().slice(0, 10), body.type, body.description]
  );

  return NextResponse.json({ ok: true });
}

// Seed historical entries — idempotent, skips duplicates by description
export async function PUT(req: NextRequest) {
  const role = getRole(req);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let inserted = 0;
  for (const entry of HISTORICAL_ENTRIES) {
    const existing = await findMany(
      `SELECT id FROM product_changelog WHERE description = ?`, [entry.description]
    );
    if (existing.length === 0) {
      await run(
        `INSERT INTO product_changelog (id, date, type, description) VALUES (?, ?, ?, ?)`,
        [randomUUID(), entry.date, entry.type, entry.description]
      );
      inserted++;
    }
  }

  return NextResponse.json({ ok: true, inserted });
}

const HISTORICAL_ENTRIES = [
  // June 28
  { date: '2026-06-28', type: 'fix',     description: 'Theme recommendations now instant static lookup (~70ms) — replaced 25s NVIDIA NIM call for archetype-based flows' },
  { date: '2026-06-28', type: 'fix',     description: 'ThemeSelector now self-fetches recommendations — no longer dependent on parent state timing' },
  { date: '2026-06-28', type: 'fix',     description: 'Card suggestions restricted to paper Magic only — no Arena Alchemy ("A-" prefix) or MTGO-exclusive cards' },
  { date: '2026-06-28', type: 'feature', description: 'ThemeSelector: "Named Archetypes" hidden when archetype already chosen; renamed to "Popular Deck Builds" for Commander flow' },
  { date: '2026-06-28', type: 'feature', description: 'ThemeSelector: Psychographic and tribal auto-select when recommendations arrive' },
  { date: '2026-06-28', type: 'feature', description: 'Card suggestions: suggestedQuantity added to AI JSON schema — constructed decks now use 3–4x staples, 2–3x role-players' },
  { date: '2026-06-28', type: 'feature', description: 'Admin product page: living product overview + running feature log added to admin portal' },
  // June 27
  { date: '2026-06-27', type: 'feature', description: 'Deck Wizard: ArchetypeSelector cards now show rich descriptions, playstyle summaries, and difficulty badges' },
  { date: '2026-06-27', type: 'feature', description: 'Deck Wizard: Theme recommendations fire when archetype is selected in non-commander formats' },
  { date: '2026-06-27', type: 'fix',     description: 'Deck Wizard: Standard/Modern now instructs AI to use 3–4x copies of key spells — was building all-singleton decks' },
  { date: '2026-06-27', type: 'fix',     description: 'Deck Wizard: Deck name starts blank and waits for AI — was defaulting to "My Standard Deck" immediately' },
  { date: '2026-06-27', type: 'fix',     description: 'My Decks: Total deck value now counts all cards (owned + unowned) via Scryfall price cache fallback' },
  { date: '2026-06-27', type: 'fix',     description: 'My Decks: MDFC cards (e.g. "Khalni Ambush // Khalni Territory") now correctly categorized — cache keyed by front face' },
  { date: '2026-06-27', type: 'infra',   description: 'LLM routing: NVIDIA NIM (Llama 3.3 70B) for 7 fast routes, Gemini for card suggestions and analysis' },
  { date: '2026-06-27', type: 'infra',   description: 'Demo mode: DEMO_MODE=true env flag routes all LLM calls through Claude Sonnet 4.5 for live demos' },
  { date: '2026-06-27', type: 'fix',     description: 'Commander explain: removed responseMimeType JSON constraint causing silent Gemini failures under rate limit' },
  // June 25
  { date: '2026-06-25', type: 'feature', description: 'Deck Wizard: full guided wizard — Format → Archetype → Themes → Budget → Card Selection → Review — with Khoa AI suggestions' },
  { date: '2026-06-25', type: 'feature', description: 'Deck Wizard: Natural Language entry mode — describe your deck in plain English, skip to card selection' },
  { date: '2026-06-25', type: 'feature', description: 'Deck Wizard: Khoa suggests cards by role (ramp, removal, win conditions, lands) with owned-card priority' },
  { date: '2026-06-25', type: 'feature', description: 'Deck Wizard: Mana curve visualization, combo detection, synergy highlights, legality gate on review step' },
  { date: '2026-06-25', type: 'feature', description: 'Collection Chat: conversation history with auto-save, pinning, and session persistence' },
  { date: '2026-06-25', type: 'feature', description: 'Collection Chat: combo finder — Khoa detects 2–3 card combos across your collection' },
  { date: '2026-06-25', type: 'feature', description: 'Collection Chat: deck recommendation suggestions based on what you own' },
  { date: '2026-06-25', type: 'feature', description: 'Collection upload: combo notification toast when Khoa finds combos in newly uploaded cards' },
  { date: '2026-06-25', type: 'feature', description: 'Collection upload: RTF file support — strips control codes and imports plain text card list' },
  { date: '2026-06-25', type: 'feature', description: 'Shop owner: card metadata (set, foil, condition, image) stored and displayed on inventory upload' },
  { date: '2026-06-25', type: 'feature', description: 'Shop owner: parsing spinner on inventory upload with progress feedback' },
  { date: '2026-06-25', type: 'feature', description: 'Shop owner: clear inventory option + collector-facing tabs in shop dashboard' },
  // June 24
  { date: '2026-06-24', type: 'feature', description: 'Navigation: persistent left nav with hamburger collapse for all three roles (collector, shop owner, admin)' },
  { date: '2026-06-24', type: 'feature', description: 'Admin console: dashboard, user management (add/remove), shop management' },
  { date: '2026-06-24', type: 'feature', description: 'Settings: user icon → settings sidebar nav for collector and shop owner roles' },
  { date: '2026-06-24', type: 'feature', description: 'Auth: change password available for all user types' },
  { date: '2026-06-24', type: 'feature', description: 'Auth: logout with signed-out confirmation screen across all roles' },
  // June 23
  { date: '2026-06-23', type: 'feature', description: 'Auth: separate login pages for collector, shop owner, and admin — role selection on /login landing' },
  { date: '2026-06-23', type: 'feature', description: 'Auth: replaced passcode auth with email/password and role-based sessions (collector / shop_owner / admin)' },
  { date: '2026-06-23', type: 'feature', description: 'Shop: full storefront foundation — onboarding flow, inventory management, card import from CSV/text' },
  { date: '2026-06-23', type: 'feature', description: 'Shop: buylist and buying campaign management' },
  { date: '2026-06-23', type: 'feature', description: 'Shop: shareable offer links with pricing rules' },
  // June 22
  { date: '2026-06-22', type: 'feature', description: 'Card detail modal with TCGPlayer buy buttons and deck strategy panel' },
  { date: '2026-06-22', type: 'feature', description: 'List copy/export in Moxfield-compatible format: "qty Name (SET) collector#"' },
  { date: '2026-06-22', type: 'infra',   description: 'Fly.io: health check endpoint, persistent volume, Prisma migrations on release' },
  // June 13
  { date: '2026-06-13', type: 'fix',     description: 'Scryfall price fetching for missing deck cards — shows market value of cards you need to buy' },
  { date: '2026-06-13', type: 'fix',     description: 'Card collection type editing UX: immediate feedback, synced modal state' },
  // June 12
  { date: '2026-06-12', type: 'feature', description: 'Deck editing: add and remove individual cards from saved decks' },
  { date: '2026-06-12', type: 'feature', description: 'Decks: cards grouped by type and sorted alphabetically' },
  { date: '2026-06-12', type: 'feature', description: 'Decks: total deck value display (owned + missing cards)' },
  { date: '2026-06-12', type: 'feature', description: 'Decks: Commander format support with color identity enforcement' },
  { date: '2026-06-12', type: 'feature', description: 'Khoa deck analysis: AI-powered synergy and weakness analysis via Gemini' },
  { date: '2026-06-12', type: 'feature', description: 'Deck creation: interactive card picker with Scryfall autocomplete' },
  // June 11
  { date: '2026-06-11', type: 'feature', description: 'Insights dashboard: price tracking, collection analytics, top value cards, most powerful cards' },
  // June 10
  { date: '2026-06-10', type: 'feature', description: 'Insights: Top Cards split into Value (price) vs Power (community sentiment via Tavily)' },
  { date: '2026-06-10', type: 'feature', description: 'Insights: card names clickable to show Scryfall card preview' },
  { date: '2026-06-10', type: 'feature', description: 'Collection Chat (Khoa): AI assistant powered by Gemini for collection questions and deck advice' },
  { date: '2026-06-10', type: 'infra',   description: 'Price tracking foundation: file-based cache, Scryfall price pulls, collection value calculation' },
  { date: '2026-06-10', type: 'infra',   description: 'LLM: migrated Khoa from Groq/Llama to Google Gemini API' },
  // June 9
  { date: '2026-06-09', type: 'feature', description: 'Mobile-optimized UI with responsive layout and reduced header on small screens' },
  { date: '2026-06-09', type: 'feature', description: 'Lists: save card lists (wishlists, acquisition targets) in addition to full decks' },
  { date: '2026-06-09', type: 'feature', description: 'Lists: ownership status per card — Paper, Arena, Both, or Not Owned — with sortable columns' },
  { date: '2026-06-09', type: 'feature', description: 'Collection upload: fast CSV parsing without AI fallback for standard formats' },
  { date: '2026-06-09', type: 'feature', description: 'Khoa: detects paper vs Arena cards in collection during analysis' },
  { date: '2026-06-09', type: 'feature', description: 'Card previews: upgraded to high-quality large Scryfall images' },
  { date: '2026-06-09', type: 'infra',   description: 'Auth: replaced NextAuth with simple passcode authentication; persistent SQLite volume on Fly.io' },
  // June 4
  { date: '2026-06-04', type: 'feature', description: 'Initial app: collection tracking, deck building, Khoa AI chat, TCGPlayer price integration, Scryfall card search' },
  { date: '2026-06-04', type: 'feature', description: 'Core tabs: Collection, Decks & Lists, Top Decks, Khoa Chat' },
  { date: '2026-06-04', type: 'feature', description: 'Collection: upload via CSV or paste, track owned cards with quantity and condition' },
];
