# MTG Simulator UI Redesign — Phase 1: Information Architecture

**Scope:** Desktop only, standard laptop viewport (~1440x900). No mobile consideration.

**Goal of this phase:** Fix *what is visible where* — no visual polish yet.

---

## The Core Problem (as reported)

Guidance (Advisor / Quiz Mode panel) lives at the top of the screen. The hand lives at
the bottom. To act on guidance, the player must scroll and lose sight of their cards —
or memorize the guidance, scroll down, and hope they remembered it right.

This is a proximity violation: two things that must be read together are physically
separated, defeating the purpose of a learning tool.

---

## The Fix: A Fixed, Non-Scrolling Decision Zone

The screen splits into two behaviors:

1. **Board state** (opponents, your permanents, life totals) — can scroll if it doesn't
   fit. Reference material you glance at, not something you act on directly every second.

2. **Decision zone** (Advisor/Quiz panel + hand) — NEVER scrolls, ALWAYS visible, pinned
   to the bottom of the viewport.

---

## Phase 2: Table Grid Layout (In Progress)

**Problem with Phase 1 as deployed:** The layout still causes excessive scrolling because
opponent information is arranged vertically in a sidebar, forcing the eye to scan up/down
and left/right repeatedly.

**Inspiration:** A real Magic table has players positioned around the edges — you sit at
the bottom, opponents on your left, top, and right. This spatial consistency means the
player's eye naturally learns where to look for each opponent's information.

**Phase 2 fix:** Reorganize the app-shell to position opponent panels spatially:

- **Bottom center:** Player (you) — decision zone with Advisor + Hand
- **Left edge:** Opponent 1 (compact threat summary + life total)
- **Top center:** Opponent 2 (compact threat summary + life total)
- **Right edge:** Opponent 3 (compact threat summary + life total)
- **Center:** Active player's board state (permanents, lands, command zone) — minimal scrolling

This eliminates the vertical opponent list and positions information where the eye naturally
expects it on a game table. Reduces scrolling by ~70% because all four player zones are
visible simultaneously without panning.

### Phase 2 Implementation Status

**Completed:**
- CSS Grid layout (3 columns × 3 rows) establishes spatial zones
- Left column (220px): Opponent threat summary sidebar
- Center column: Main board area with opponent displays
- Right column (220px): Phase rail (turn/phase/step tracker)
- Bottom row (280px): Decision zone (Advisor + Hand side-by-side)
- Compact opponent cards for left sidebar
- Grid provides natural "table" spatial structure

**Next Steps (Future):**
To fully achieve natural table seating, break opponent vertical list into
positional "seat" panels:
- Opponent 1: Left edge (Compact info: name, life, threat level)
- Opponent 2: Top edge (Compact info: name, life, threat level)
- Opponent 3: Right edge (Compact info: name, life, threat level)
- Player (You): Bottom center (Decision zone with Advisor + Hand)

This would require restructuring opponent display logic from shared PlayerBoard
component to positional "seat" components. Current grid CSS is ready to support
this refactor.
