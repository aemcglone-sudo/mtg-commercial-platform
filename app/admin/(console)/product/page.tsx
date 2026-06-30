'use client';
import { useEffect, useState } from 'react';

type ChangelogEntry = { id: string; date: string; type: string; description: string };

function FeatureLog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/admin/changelog');
    if (res.ok) {
      const data = await res.json() as { entries: ChangelogEntry[] };
      setEntries(data.entries);
    }
  }

  async function seed() {
    setSeeding(true);
    const res = await fetch('/api/admin/changelog', { method: 'PUT' });
    const data = await res.json() as { inserted: number };
    setSeedMsg(`Seeded ${data.inserted} historical entries`);
    setSeeding(false);
    load();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-100">Feature Log</h2>
        <div className="flex items-center gap-3">
          {seedMsg && <span className="text-xs text-green-400">{seedMsg}</span>}
          <button
            type="button"
            onClick={seed}
            disabled={seeding}
            className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded px-2.5 py-1 transition-colors disabled:opacity-50"
          >
            {seeding ? 'Seeding…' : 'Seed history'}
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="text-zinc-600 text-sm">No entries yet. Click &quot;Seed history&quot; to backfill all historical entries.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="flex gap-4 text-sm">
              <span className="text-zinc-600 shrink-0 w-24">{entry.date}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium h-fit ${
                entry.type === 'feature' ? 'bg-green-900/40 text-green-400 border border-green-800' :
                entry.type === 'fix'     ? 'bg-blue-900/40 text-blue-400 border border-blue-800' :
                                          'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>{entry.type}</span>
              <span className="text-zinc-300">{entry.description}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ProductPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-1">Grimoire — Product Overview</h1>
        <p className="text-zinc-500 text-sm">Living document. Updated as features ship.</p>
      </div>

      {/* What It Is */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">What It Is</h2>
        <p className="text-zinc-300 leading-relaxed mb-4">
          Grimoire is a Magic: The Gathering platform that connects two types of users: <strong className="text-zinc-100">collectors</strong> who own cards and want to build decks with them, and <strong className="text-zinc-100">local card shops</strong> that buy and sell singles. Collectors are the core user — they own physical cards, track their collection, and want to build the best decks they can from what they have, filling gaps by buying singles from local stores.
        </p>
        <p className="text-zinc-400 leading-relaxed">
          The platform launched June 4, 2026. It shipped collection management, AI-powered deck building, a full shop owner storefront, role-based authentication for three user types, an admin console, a guided deck wizard with AI card suggestions, and — as of late June — a complete local marketplace connecting collectors to nearby shops for singles, sealed product, and accessories, with SMS/in-app notifications, a card watchlist, and shop-run promotional campaigns.
        </p>
      </section>

      {/* For Collectors */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">For Collectors</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Collection Management</h3>
            <p className="text-zinc-400 leading-relaxed">Upload a card collection via CSV paste or file import (including RTF exports from other tools). Track owned cards with quantity, condition, and whether each card is in a paper collection, Arena, or both. Prices are pulled from TCGPlayer and auto-updated. Total collection value is calculated and displayed. The collection is cross-referenced against any deck being built so the collector always knows what they have vs. what they still need.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Deck Building — The Wizard</h3>
            <p className="text-zinc-400 leading-relaxed">A guided six-step deck builder: Format → Archetype → Themes → Budget → Card Selection → Review. Supported formats include Commander, Standard, Modern, Pioneer, Legacy, and more. When an archetype is chosen (Aggro, Control, Midrange, Combo, Tempo, Prison, Ramp), instant theme recommendations pre-highlight the best matching strategy themes and auto-select a playstyle. An AI assistant named Khoa then generates role-organized card suggestions — ramp, removal, win conditions, lands — tailored to the chosen strategy, knowing what the collector already owns and prioritizing those first. For Commander it enforces singleton; for constructed formats it recommends 3–4x copies of staples. A Natural Language shortcut lets experienced players describe their deck in plain text and skip directly to card selection. The review step shows mana curve, detected combos, synergies, and a legality gate before saving.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Lists &amp; Wishlists</h3>
            <p className="text-zinc-400 leading-relaxed">Save card lists separately from full decks — useful for wishlists, acquisition targets, or sets of cards being tracked. Lists show ownership status per card (Paper, Arena, Both, Not Owned) with sortable columns for name, quantity, price, type, CMC, and color identity.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Khoa — Collection Chat</h3>
            <p className="text-zinc-400 leading-relaxed">An AI assistant (Khoa) that collectors can talk to directly about their collection and decks. Ask things like &ldquo;what&apos;s the best deck I can build from what I own?&rdquo; or &ldquo;suggest upgrades to my Edgar Markov deck under $50.&rdquo; Khoa detects combos across the collection, recommends deck strategies, can swap specific cards in and out, and respects budget constraints. Conversations auto-save with history and pinning. Khoa only suggests paper cards — no Arena Alchemy or MTGO exclusives.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">My Decks</h3>
            <p className="text-zinc-400 leading-relaxed">Save, view, and edit built decks. Cards are grouped by type and sorted alphabetically. Khoa analyzes any deck for combos, synergies, mana curve, and weaknesses. Total deck value is shown for both owned and unowned cards against current market prices. Decks export in Moxfield-compatible format. Missing cards show their TCGPlayer price so the collector knows exactly what it would cost to complete the deck.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Insights Dashboard</h3>
            <p className="text-zinc-400 leading-relaxed">A collection analytics view showing total value, price trends over time, top cards by market value, and top cards by community power ranking (sourced via Tavily). Card names are clickable to show a full Scryfall card preview with current pricing.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Top Decks</h3>
            <p className="text-zinc-400 leading-relaxed">Browse popular Commander and constructed decks from the broader MTG community. Cards are displayed with ownership indicators so collectors can immediately see how much of a deck they already have.</p>
          </div>
        </div>
      </section>

      {/* For Shop Owners */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">For Shop Owners</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Onboarding</h3>
            <p className="text-zinc-400 leading-relaxed">Dedicated shop owner registration and login separate from collector accounts. Guided setup flow captures store name, location, contact info, and preferences. Shop owners have their own dashboard distinct from the collector experience.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Inventory Management</h3>
            <p className="text-zinc-400 leading-relaxed">Upload and manage card inventory with card name, set, condition, quantity, and pricing. Bulk upload via CSV or paste. Each card is enriched with Scryfall metadata (image, set symbol, collector number, foil status). Market prices auto-update against TCGPlayer so inventory values stay current. Inventory can be cleared and re-uploaded in bulk.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Buylist &amp; Campaigns</h3>
            <p className="text-zinc-400 leading-relaxed">Create buying campaigns specifying which cards the store wants to acquire and at what price. Collectors on the platform can browse active buylists and bring cards in. Campaign management includes start/end dates, per-card pricing rules, and status tracking.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Offers &amp; Pricing</h3>
            <p className="text-zinc-400 leading-relaxed">Generate shareable offer links for specific card transactions. Set pricing rules with percentage adjustments relative to market price. Manage purchase history and track completed transactions. Price alerts for cards crossing defined thresholds.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Shop Insights</h3>
            <p className="text-zinc-400 leading-relaxed">Four analytics dashboards give store owners a real-time view of business performance. <strong className="text-zinc-300">Overview</strong> surfaces total inventory value, cost basis, units sold, and margin by rarity. <strong className="text-zinc-300">Performance</strong> tracks revenue, cost, and profit month-over-month with a rolling trend chart. <strong className="text-zinc-300">Pricing Intelligence</strong> identifies underpriced cards (vs TCGPlayer market) and cards that have gained value since acquisition — so owners know what to reprice. <strong className="text-zinc-300">Velocity</strong> shows top-selling cards, recently sold items, and dead-stock cards that have sat idle, helping owners make restocking and markdown decisions.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Pricing Rules Engine</h3>
            <p className="text-zinc-400 leading-relaxed">A rule-based pricing system separate from one-off offer links. Owners build ordered sell-pricing rules (condition multipliers against market price) and buy-pricing rules (buylist offer percentages), with a pricing matrix for combined condition/rarity logic and configurable price floors so cards never sell below cost. A wizard previews the effect of a rule change across the live inventory before it&apos;s applied, and bulk repricing pushes updated prices across the whole store in one action.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Orders &amp; Purchases</h3>
            <p className="text-zinc-400 leading-relaxed">Dedicated pages track marketplace orders (fulfilled holds) and buylist purchases (cards bought from collectors) separately from the general transaction history, giving owners a clear ledger of what came in vs. what went out.</p>
          </div>
        </div>
      </section>

      {/* Auth & Admin */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">Auth &amp; Admin</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Three-Role Authentication</h3>
            <p className="text-zinc-400 leading-relaxed">Separate login pages and sessions for collectors, shop owners, and admins. Email/password authentication with role-based access control. Each role sees a completely different UI — collectors see collection tools, shop owners see inventory tools, admins see the console. Persistent left nav with hamburger collapse. Settings sidebar with password change and account management.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Admin Console</h3>
            <p className="text-zinc-400 leading-relaxed">Dashboard with platform stats, user management (view, add, remove), shop management, MTG deck-building rules editor (controls what Khoa recommends), and this product overview page. Accessible at /admin.</p>
          </div>
        </div>
      </section>

      {/* Local Marketplace */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-100 mb-1 pb-2 border-b border-zinc-800">Local Marketplace</h2>
        <p className="text-zinc-400 leading-relaxed mb-6">
          Connects collectors who need specific cards, sealed product, or accessories to local stores that have them in stock — closing the loop between deck building and acquisition.
        </p>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">The Problem</h3>
            <p className="text-zinc-400 leading-relaxed">A collector finishes building a deck and has a list of cards they need. There&apos;s no good way to know which local store has those exact cards. And there&apos;s no easy way for a store to surface their inventory to local players who are actively building.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Find Locally</h3>
            <p className="text-zinc-400 leading-relaxed">After building a deck — or viewing any saved deck — the collector sees which cards they&apos;re missing from their collection. They click &ldquo;Find Locally&rdquo; and Grimoire shows which nearby stores have those exact cards in stock, with price and condition. Search supports Scryfall autocomplete, GPS or manual location entry, an adjustable search radius, and an interactive map (Leaflet/OpenStreetMap) showing pinned shop locations alongside the list view, with hover-sync between the list and the map. A card can also be deep-linked straight to its local-availability results from anywhere in the app.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Hold Workflow</h3>
            <p className="text-zinc-400 leading-relaxed mb-2">The collector requests a hold and adds a note about when they can pick up. The store gets notified immediately — in-app and SMS. The owner confirms availability and sets a pickup window. The collector gets notified with the store&apos;s address, hours, and any shop-specific pickup instructions. When the collector picks up, the owner marks it complete. Holds expire automatically via a scheduled job: requested holds expire after 24 hours unconfirmed, confirmed holds expire after a 72-hour pickup window, and the card is returned to available inventory.</p>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2">
              <span className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1">Requested</span>
              <span>→</span>
              <span className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1">Confirmed</span>
              <span>→</span>
              <span className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1">Completed</span>
              <span className="text-zinc-700">or</span>
              <span className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1">Declined</span>
              <span className="text-zinc-700">or</span>
              <span className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1">Expired</span>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Store Discovery</h3>
            <p className="text-zinc-400 leading-relaxed">A <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">/stores</code> page lists all participating shops with address, hours, specialties, and live inventory. Each shop has a public profile page with hours, contact info, hold instructions, a location map, and a searchable view of its sellable inventory with condition badges and hold buttons on individual cards. Shops are public by default with opt-out available to the store owner.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Sealed Products &amp; Accessories</h3>
            <p className="text-zinc-400 leading-relaxed">Beyond singles, collectors can browse sealed product (booster boxes, collector boxes, bundles, commander precons, prerelease kits) and accessories (sleeves, deck boxes, playmats, dice, binders, storage) carried by local shops, filtered by type and category, with MSRP shown and nearby-shop availability and distance. The collector view only ever shows what a shop has actually listed — never an unfiltered catalog. Shop owners add listings by searching a built-in product catalog (drawn from real product/MSRP data) or, for anything not in the catalog, entering it manually with a name and category. If a collector wants something a shop doesn&apos;t currently have, they can send a product request with an optional note; the shop owner sees it in a Requests queue and responds available or declined, which notifies the collector back.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Notifications</h3>
            <p className="text-zinc-400 leading-relaxed">A notification bell in the header shows an unread-count badge and opens a drawer listing hold and marketplace activity (confirmed, declined, completed, cancelled, expired, card-available, shop campaigns) with relative timestamps and per-item or mark-all-read controls, auto-refreshing every 60 seconds. The same events are mirrored to SMS (via Twilio) for collectors and shop owners who opt in, covering hold requested/confirmed/declined/cancelled and watchlist card-available alerts.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Card Watchlist</h3>
            <p className="text-zinc-400 leading-relaxed">Collectors can watch specific cards manually, and cards missing from any saved deck are auto-added to the watchlist via a scheduled sync job. When a watched card shows up in a nearby shop&apos;s inventory within the collector&apos;s radius and price ceiling, they get notified (in-app and SMS), with a per-card cooldown to avoid repeat alerts and respect for any shops the collector has muted.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Marketplace Preferences</h3>
            <p className="text-zinc-400 leading-relaxed">Collectors set a home address (geocoded automatically or via GPS), a search radius, SMS opt-in with phone number, and separate toggles for card-availability alerts vs. shop campaigns/promotions. Individual shops can be muted to stop their campaign messages without losing hold or watchlist notifications.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Shop Marketplace Campaigns</h3>
            <p className="text-zinc-400 leading-relaxed">Shop owners can message opted-in nearby collectors directly — general announcements, sales, new arrivals, buylist updates, or event/tournament promos — with a subject and short message, sent as in-app notifications and SMS. Campaigns are capped at 3 sends per week per shop, show an estimated recipient count before sending, and keep a history of drafts and sent campaigns.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2">Shop Setup &amp; Marketplace Settings</h3>
            <p className="text-zinc-400 leading-relaxed">A guided setup flow captures store name, description, address (with auto-geocoding), and contact info, then routes into inventory upload. A separate marketplace settings tab lets owners configure hold mechanics and visibility for the local marketplace independent of their core storefront settings.</p>
          </div>
        </div>
      </section>

      {/* The Loop */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">The Loop</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            'Collector builds a deck',
            'Khoa shows what\'s missing',
            'Find cards at a local store',
            'Request a hold',
            'Walk in and buy',
          ].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-300">{step}</span>
              {i < arr.length - 1 && <span className="text-zinc-600">→</span>}
            </span>
          ))}
        </div>
        <p className="text-zinc-500 text-sm mt-4">The store gets a warm lead with specific card demand. The collector gets their cards without gambling on whether the store has them. Local game stores stay competitive against online retailers.</p>
      </section>

      <FeatureLog />
    </div>
  );
}

// Historical entries live in /api/admin/changelog (PUT to seed)
const _UNUSED: { date: string; type: 'feature' | 'fix' | 'infra'; description: string }[] = [
  // June 30
  { date: '2026-06-30', type: 'feature', description: 'Shop owners: Add Product modal now searches the real sealed-product/accessory catalog (661 items) with a live scrollable results list, plus a manual fallback for anything not in the catalog' },
  { date: '2026-06-30', type: 'fix',     description: 'Shop owner product add was 403ing for accounts with a stale collector-role session cookie — role now refreshed by re-login' },
  { date: '2026-06-30', type: 'fix',     description: 'Marketplace product queries referenced a non-existent shops.marketplaceEnabled column — corrected to marketplace_active across 3 routes, fixing collector Products page and nearby-shop lookups' },
  { date: '2026-06-30', type: 'feature', description: 'Collector Products page sourced strictly from shop-listed inventory (shop_products), not the full catalog — categories filter reflects only what local shops actually carry' },
  { date: '2026-06-30', type: 'feature', description: 'Admin product overview page brought up to date with full Local Marketplace feature set (previously marked "Planned" despite being shipped) and shop pricing rules / orders / purchases sections' },
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
  { date: '2026-06-09', type: 'feature', description: 'Lists: ownership status per card — Paper, Arena, Both, or Not Owned — with sortable columns (name, qty, price, type, CMC, color)' },
  { date: '2026-06-09', type: 'feature', description: 'Collection upload: fast CSV parsing without AI fallback for standard formats' },
  { date: '2026-06-09', type: 'feature', description: 'Khoa: detects paper vs Arena cards in collection during analysis' },
  { date: '2026-06-09', type: 'feature', description: 'Card previews: upgraded to high-quality large Scryfall images' },
  { date: '2026-06-09', type: 'feature', description: 'Khoa: can generate comprehensive card lists with proper formatting for import' },
  { date: '2026-06-09', type: 'infra',   description: 'Auth: replaced NextAuth with simple passcode authentication; persistent SQLite volume on Fly.io' },
  { date: '2026-06-09', type: 'infra',   description: 'Multi-device collection sync via fixed user ID' },
  // June 4
  { date: '2026-06-04', type: 'feature', description: 'Initial app: collection tracking, deck building, Khoa AI chat (then called Shahrazad), TCGPlayer price integration, Scryfall card search' },
  { date: '2026-06-04', type: 'feature', description: 'Core tabs: Collection, Decks & Lists, Top Decks, Khoa Chat' },
  { date: '2026-06-04', type: 'feature', description: 'Collection: upload via CSV or paste, track owned cards with quantity and condition' },
  { date: '2026-06-04', type: 'feature', description: 'Decks: create decks with interactive card picker, view by type, export in Moxfield format' },
  { date: '2026-06-04', type: 'feature', description: 'Top Decks: browse popular commander and constructed decks' },
];
